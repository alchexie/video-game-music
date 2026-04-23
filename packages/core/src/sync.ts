import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import COS from 'cos-nodejs-sdk-v5';

import type { AppConfig } from './config.js';
import { all, mapAlbum, mapMediaAsset, prepare, run, transaction } from './db.js';
import type { DatabaseContext } from './db.js';

const UPLOAD_CONCURRENCY = 6;
const MAX_RETRIES = 2;
const CACHE_CONTROL = 'public,max-age=31536000,immutable,s-maxage=31536000';

/** Build a plain COS object URL (no SDK signing) */
export { getCosBaseUrl } from './cos-url.js';

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const code = (error as Record<string, unknown>).statusCode ?? (error as Record<string, unknown>).code;
    if (typeof code === 'number' && code >= 500) return true;
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EPIPE') return true;
  }
  return false;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertCosConfig(config: AppConfig): asserts config is AppConfig & {
  cosBucket: string;
  cosRegion: string;
  cosSecretId: string;
  cosSecretKey: string;
} {
  if (!config.cosBucket || !config.cosRegion || !config.cosSecretId || !config.cosSecretKey) {
    throw new Error('COS credentials are incomplete. Set COS_BUCKET, COS_REGION, COS_SECRET_ID, and COS_SECRET_KEY.');
  }
}

function createCosClient(config: AppConfig): COS {
  return new COS({
    SecretId: config.cosSecretId!,
    SecretKey: config.cosSecretKey!,
  });
}

export async function uploadMediaToCos(context: DatabaseContext, config: AppConfig) {
  assertCosConfig(config);
  const client = createCosClient(config);

  const assets = all<Record<string, unknown>>(context, `
    SELECT *
    FROM mediaAssets
    WHERE presenceStatus = 'active'
      AND syncStatus != 'synced'
  `).map(mapMediaAsset);

  const total = assets.length;
  console.log(`待上传文件：${total} 个`);

  const succeededIds: string[] = [];
  const failedIds: string[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < total) {
      const i = nextIndex++;
      const asset = assets[i]!;
      const prefix = `[${i + 1}/${total}]`;
      const localAudioPath = path.join(config.libraryRoot, ...asset.relativePath.split('/'));
      const audioKey = `audio/${asset.publicId}${asset.extension}`;
      let success = false;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt === 0) {
            process.stdout.write(`${prefix} 上传中 ${asset.relativePath} ...`);
          } else {
            process.stdout.write(`${prefix} 重试(${attempt}) ${asset.relativePath} ...`);
          }
          await uploadFile(client, config, localAudioPath, audioKey);
          process.stdout.write(' ✓\n');
          succeededIds.push(asset.publicId);
          success = true;
          break;
        } catch (error) {
          if (attempt < MAX_RETRIES && isRetryableError(error)) {
            process.stdout.write(' ⟳\n');
            await sleep(1000 * 2 ** attempt);
            continue;
          }
          process.stdout.write(' ✗\n');
          console.error(`${prefix} 失败 ${asset.relativePath}:`, error);
        }
      }

      if (!success) {
        failedIds.push(asset.publicId);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, total) }, worker));

  // Batch DB updates in a single transaction
  const now = new Date().toISOString();
  transaction(context, () => {
    const updateStmt = prepare(context, `
      UPDATE mediaAssets SET syncStatus = ?, updatedAt = ? WHERE publicId = ?
    `);
    for (const id of succeededIds) {
      updateStmt.run('synced', now, id);
    }
    for (const id of failedIds) {
      updateStmt.run('failed', now, id);
    }
  });

  // Upload covers to COS
  const coverSummary = await uploadCoversToCos(context, config, client);

  return {
    uploadedAudio: succeededIds.length,
    failed: failedIds.length,
    ...coverSummary,
  };
}

/** Upload cover images to COS covers/ prefix. Only uploads covers that don't already exist on COS. */
async function uploadCoversToCos(
  context: DatabaseContext,
  config: AppConfig,
  client: COS,
): Promise<{ uploadedCovers: number; failedCovers: number }> {
  const coversDir = path.join(config.mediaCacheDir, 'covers');

  // Get all album IDs that should have covers
  const albumIds = all<{ publicId: string }>(context, `SELECT publicId FROM albums`).map((a) => a.publicId);

  // Check which local cover files exist
  const localCovers: Array<{ albumId: string; filePath: string }> = [];
  for (const albumId of albumIds) {
    const filePath = path.join(coversDir, `${albumId}.png`);
    try {
      await fsPromises.access(filePath);
      localCovers.push({ albumId, filePath });
    } catch {
      // no local cover for this album
    }
  }

  if (localCovers.length === 0) {
    console.log('没有需要上传的封面文件');
    return { uploadedCovers: 0, failedCovers: 0 };
  }

  // List existing COS covers to skip already-uploaded ones
  const existingCosKeys = new Set(await listAllCosObjects(client, config, 'covers/'));
  const toUpload = localCovers.filter((c) => !existingCosKeys.has(`covers/${c.albumId}.png`));

  console.log(`封面总数：${localCovers.length}，已存在于 COS：${localCovers.length - toUpload.length}，待上传：${toUpload.length}`);

  if (toUpload.length === 0) {
    return { uploadedCovers: 0, failedCovers: 0 };
  }

  let uploadedCovers = 0;
  let failedCovers = 0;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < toUpload.length) {
      const i = nextIndex++;
      const item = toUpload[i]!;
      const key = `covers/${item.albumId}.png`;
      const prefix = `[cover ${i + 1}/${toUpload.length}]`;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt === 0) {
            process.stdout.write(`${prefix} 上传封面 ${item.albumId} ...`);
          } else {
            process.stdout.write(`${prefix} 重试(${attempt}) ${item.albumId} ...`);
          }
          await uploadFile(client, config, item.filePath, key);
          process.stdout.write(' ✓\n');
          uploadedCovers++;
          break;
        } catch (error) {
          if (attempt < MAX_RETRIES && isRetryableError(error)) {
            process.stdout.write(' ⟳\n');
            await sleep(1000 * 2 ** attempt);
            continue;
          }
          process.stdout.write(' ✗\n');
          console.error(`${prefix} 封面上传失败 ${item.albumId}:`, error);
          failedCovers++;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, toUpload.length) }, worker));

  return { uploadedCovers, failedCovers };
}

function uploadFile(client: COS, config: AppConfig, filePath: string, key: string) {
  return new Promise<void>((resolve, reject) => {
    client.sliceUploadFile(
      {
        Bucket: config.cosBucket!,
        Region: config.cosRegion!,
        Key: key,
        FilePath: filePath,
        Headers: {
          'Cache-Control': CACHE_CONTROL,
        },
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });
}

export interface PruneCosOrphansSummary {
  scanned: number;
  deleted: number;
  failed: number;
  scannedCovers: number;
  deletedCovers: number;
  failedCovers: number;
}

export async function pruneCosOrphans(
  context: DatabaseContext,
  config: AppConfig,
): Promise<PruneCosOrphansSummary> {
  assertCosConfig(config);
  const client = createCosClient(config);

  // --- Prune orphan audio files ---
  const allAssets = all<Record<string, unknown>>(context, 'SELECT publicId, extension FROM mediaAssets').map(mapMediaAsset);
  const expectedAudioKeys = new Set(allAssets.map((a) => `audio/${a.publicId}${a.extension}`));

  const cosAudioKeys = await listAllCosObjects(client, config, 'audio/');
  const orphanAudioKeys = cosAudioKeys.filter((key) => !expectedAudioKeys.has(key));

  console.log(`COS 音频对象总数：${cosAudioKeys.length}，数据库期望：${expectedAudioKeys.size}，待删除：${orphanAudioKeys.length}`);

  let deletedAudio = 0;
  let failedAudio = 0;

  if (orphanAudioKeys.length > 0) {
    const result = await batchDeleteCosObjects(client, config, orphanAudioKeys);
    deletedAudio = result.deleted;
    failedAudio = result.failed;
  }

  // --- Prune orphan cover files ---
  const allAlbumIds = new Set(
    all<{ publicId: string }>(context, 'SELECT publicId FROM albums').map((a) => a.publicId),
  );
  const expectedCoverKeys = new Set([...allAlbumIds].map((id) => `covers/${id}.png`));

  const cosCoverKeys = await listAllCosObjects(client, config, 'covers/');
  const orphanCoverKeys = cosCoverKeys.filter((key) => !expectedCoverKeys.has(key));

  console.log(`COS 封面对象总数：${cosCoverKeys.length}，数据库期望：${expectedCoverKeys.size}，待删除：${orphanCoverKeys.length}`);

  let deletedCovers = 0;
  let failedCovers = 0;

  if (orphanCoverKeys.length > 0) {
    const result = await batchDeleteCosObjects(client, config, orphanCoverKeys);
    deletedCovers = result.deleted;
    failedCovers = result.failed;
  }

  return {
    scanned: cosAudioKeys.length,
    deleted: deletedAudio,
    failed: failedAudio,
    scannedCovers: cosCoverKeys.length,
    deletedCovers,
    failedCovers,
  };
}

async function batchDeleteCosObjects(
  client: COS,
  config: AppConfig,
  keys: string[],
): Promise<{ deleted: number; failed: number }> {
  const BATCH_SIZE = 1000;
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    try {
      await deleteMultipleCosObjects(client, config, batch);
      deleted += batch.length;
      console.log(`已删除 ${deleted}/${keys.length}`);
    } catch (error) {
      failed += batch.length;
      console.error(`批量删除失败 [${i}–${i + batch.length}]:`, error);
    }
  }

  return { deleted, failed };
}

async function listAllCosObjects(client: COS, config: AppConfig, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let marker = '';

  while (true) {
    const result = await new Promise<COS.GetBucketResult>((resolve, reject) => {
      client.getBucket(
        {
          Bucket: config.cosBucket!,
          Region: config.cosRegion!,
          Prefix: prefix,
          MaxKeys: 1000,
          Marker: marker || undefined,
        },
        (error, data) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        },
      );
    });

    for (const obj of result.Contents ?? []) {
      keys.push(obj.Key);
    }

    if (result.IsTruncated === 'true') {
      marker = result.NextMarker ?? '';
    } else {
      break;
    }
  }

  return keys;
}

function deleteMultipleCosObjects(client: COS, config: AppConfig, keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    client.deleteMultipleObject(
      {
        Bucket: config.cosBucket!,
        Region: config.cosRegion!,
        Objects: keys.map((Key) => ({ Key })),
      },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });
}
