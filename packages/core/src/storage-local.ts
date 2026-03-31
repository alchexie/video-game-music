import path from 'node:path';

import { parseFile } from 'music-metadata';
import sharp from 'sharp';

import type { StreamResolution } from './media.js';
import type { StorageProvider } from './storage.js';

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly libraryRoot: string) {}

  async resolveAudioStream(
    _publicId: string,
    _extension: string,
    relativePath: string,
  ): Promise<StreamResolution | null> {
    return {
      mode: 'local',
      filePath: path.join(this.libraryRoot, ...relativePath.split('/')),
      mimeType: this.guessMimeType(relativePath),
    };
  }

  async resolveEmbeddedCover(relativePath: string): Promise<Buffer | null> {
    const filePath = path.join(this.libraryRoot, ...relativePath.split('/'));
    const metadata = await parseFile(filePath, { skipCovers: false, duration: false });
    const picture = metadata.common.picture?.[0];
    if (!picture) return null;

    return sharp(Buffer.from(picture.data))
      .resize(512, 512, { fit: 'inside' })
      .png()
      .toBuffer();
  }

  private guessMimeType(relativePath: string): string {
    const ext = path.extname(relativePath).toLowerCase();
    const map: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
