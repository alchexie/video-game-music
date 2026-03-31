import type { StreamResolution } from './media.js';

export interface StorageProvider {
  resolveAudioStream(publicId: string, extension: string, relativePath: string): Promise<StreamResolution | null>;
  resolveEmbeddedCover(relativePath: string): Promise<Buffer | null>;
}
