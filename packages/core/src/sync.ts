import path from 'node:path';

import COS from 'cos-nodejs-sdk-v5';

import type { AppConfig } from './config.js';
import { all, mapMediaAsset, prepare, run, transaction } from './db.js';
import type { DatabaseContext } from './db.js';

const UPLOAD_CONCURRENCY = 6;
const MAX_RETRIES = 2;

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

export async function uploadMediaToCos(context: DatabaseContext, config: AppConfig) {
  if (!config.cosBucket || !config.cosRegion || !config.cosSecretId || !config.cosSecretKey) {
    throw new Error('COS credentials are incomplete. Set COS_BUCKET, COS_REGION, COS_SECRET_ID, and COS_SECRET_KEY.');
  }

  const client = new COS({
    SecretId: config.cosSecretId,
    SecretKey: config.cosSecretKey,
  });

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
  let completedCount = 0;

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

      completedCount++;
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

  return {
    uploadedAudio: succeededIds.length,
    failed: failedIds.length,
  };
}

function uploadFile(client: COS, config: AppConfig, filePath: string, key: string) {
  return new Promise<void>((resolve, reject) => {
    client.sliceUploadFile(
      {
        Bucket: config.cosBucket!,
        Region: config.cosRegion!,
        Key: key,
        FilePath: filePath,
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
}

export async function pruneCosOrphans(
  context: DatabaseContext,
  config: AppConfig,
): Promise<PruneCosOrphansSummary> {
  if (!config.cosBucket || !config.cosRegion || !config.cosSecretId || !config.cosSecretKey) {
    throw new Error('COS credentials are incomplete. Set COS_BUCKET, COS_REGION, COS_SECRET_ID, and COS_SECRET_KEY.');
  }

  const client = new COS({
    SecretId: config.cosSecretId,
    SecretKey: config.cosSecretKey,
  });

  // 从数据库构建所有期望存在于 COS 上的 key 集合（与 presenceStatus 无关，只要在 DB 中即保留）
  const allAssets = all<Record<string, unknown>>(context, 'SELECT publicId, extension FROM mediaAssets').map(mapMediaAsset);
  const expectedKeys = new Set(allAssets.map((a) => `audio/${a.publicId}${a.extension}`));

  // 列出 COS 上 audio/ 前缀下的全部对象
  const cosKeys = await listAllCosObjects(client, config, 'audio/');
  const orphanKeys = cosKeys.filter((key) => !expectedKeys.has(key));

  console.log(`COS 对象总数：${cosKeys.length}，数据库期望：${expectedKeys.size}，待删除：${orphanKeys.length}`);

  if (orphanKeys.length === 0) {
    return { scanned: cosKeys.length, deleted: 0, failed: 0 };
  }

  // 分批删除，每批最多 1000 个
  const BATCH_SIZE = 1000;
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < orphanKeys.length; i += BATCH_SIZE) {
    const batch = orphanKeys.slice(i, i + BATCH_SIZE);
    try {
      await deleteMultipleCosObjects(client, config, batch);
      deleted += batch.length;
      console.log(`已删除 ${deleted}/${orphanKeys.length}`);
    } catch (error) {
      failed += batch.length;
      console.error(`批量删除失败 [${i}–${i + batch.length}]:`, error);
    }
  }

  return { scanned: cosKeys.length, deleted, failed };
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
