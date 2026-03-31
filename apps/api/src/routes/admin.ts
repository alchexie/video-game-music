import {
  commitLibrary,
  getDatabase,
  patchAlbum,
  patchTrack,
  searchCatalog,
  uploadMediaToCos,
} from '@vgm/core';
import { NotFoundError, patchAlbumSchema, patchTrackSchema } from '@vgm/shared';
import type { FastifyInstance } from 'fastify';

import type { RouteContext } from './types.js';

function formatImportProgress(event: import('@vgm/shared').ImportProgressEvent) {
  const progress = event.total ? ` ${event.processed ?? 0}/${event.total}` : '';
  const elapsed = typeof event.elapsedMs === 'number' ? ` (${Math.round(event.elapsedMs / 1000)}s)` : '';
  return `[import:${event.phase}]${progress}${elapsed} ${event.message}`;
}

export async function adminRoutes(app: FastifyInstance, { config }: RouteContext) {
  app.get('/api/search', async (request) => {
    const context = await getDatabase(config);
    const { q = '' } = request.query as { q?: string };
    return searchCatalog(context, q);
  });

  app.post('/api/admin/import/commit', async (request) => {
    const context = await getDatabase(config);
    return commitLibrary(context, {
      ...config,
      onImportProgress: (event) => request.log.info(formatImportProgress(event)),
    });
  });

  app.post('/api/admin/sync/cos', async () => {
    const context = await getDatabase(config);
    return uploadMediaToCos(context, config);
  });

  app.patch('/api/admin/albums/:id', async (request) => {
    const context = await getDatabase(config);
    const input = patchAlbumSchema.parse(request.body);
    const album = await patchAlbum(context, (request.params as { id: string }).id, input);

    if (!album) {
      throw new NotFoundError('Album', (request.params as { id: string }).id);
    }

    return album;
  });

  app.patch('/api/admin/tracks/:id', async (request) => {
    const context = await getDatabase(config);
    const input = patchTrackSchema.parse(request.body);
    const track = await patchTrack(context, (request.params as { id: string }).id, input);

    if (!track) {
      throw new NotFoundError('Track', (request.params as { id: string }).id);
    }

    return track;
  });
}
