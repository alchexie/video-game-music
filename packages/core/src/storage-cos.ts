import type { StreamResolution } from './media.js';
import type { StorageProvider } from './storage.js';

export class CosStorageProvider implements StorageProvider {
  constructor(
    private readonly bucket: string,
    private readonly region: string,
  ) {}

  async resolveAudioStream(
    publicId: string,
    extension: string,
    _relativePath: string,
  ): Promise<StreamResolution | null> {
    const key = `audio/${publicId}${extension}`;
    const redirectUrl = this.getObjectUrl(key);
    return { mode: 'redirect', redirectUrl };
  }

  async resolveEmbeddedCover(_relativePath: string): Promise<Buffer | null> {
    // COS mode does not support embedded cover extraction
    return null;
  }

  resolveCoverUrl(albumId: string): string {
    return this.getObjectUrl(`covers/${albumId}.png`);
  }

  private getObjectUrl(key: string): string {
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
  }
}
