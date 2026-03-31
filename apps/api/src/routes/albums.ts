import {
  getAlbumDetail,
  getDatabase,
  listAlbums,
  searchAlbums,
} from '@vgm/core';
import { NotFoundError } from '@vgm/shared';
import type { FastifyInstance } from 'fastify';

import type { RouteContext } from './types.js';

export async function albumRoutes(app: FastifyInstance, { config }: RouteContext) {
  app.get('/api/albums/search', async (request) => {
    const context = await getDatabase(config);
    const { q, artist, genre, year, seriesId, limit, offset } = request.query as {
      q?: string;
      artist?: string;
      genre?: string;
      year?: string;
      seriesId?: string;
      limit?: string;
      offset?: string;
    };

    const result = await searchAlbums(context, {
      q,
      artist,
      genre,
      year: year !== undefined ? Number(year) : undefined,
      seriesId,
      limit: limit !== undefined ? Number(limit) : 20,
      offset: offset !== undefined ? Number(offset) : 0,
    });

    const baseUrl = config.baseUrl ?? `${request.protocol}://${request.headers.host}`;
    return {
      ...result,
      items: result.items.map((album) => ({
        ...album,
        coverUrl: `${baseUrl}/api/assets/${album.publicId}/cover`,
      })),
    };
  });

  app.get('/api/albums', async () => {
    const context = await getDatabase(config);
    return listAlbums(context);
  });

  app.get('/api/albums/:id', async (request) => {
    const context = await getDatabase(config);
    const album = await getAlbumDetail(context, (request.params as { id: string }).id);

    if (!album) {
      throw new NotFoundError('Album', (request.params as { id: string }).id);
    }

    return album;
  });

  app.get('/api/albums/:id/tracks', async (request) => {
    const context = await getDatabase(config);
    const album = await getAlbumDetail(context, (request.params as { id: string }).id);

    if (!album) {
      throw new NotFoundError('Album', (request.params as { id: string }).id);
    }

    return album.tracks;
  });
}
