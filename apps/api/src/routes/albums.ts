import {
  getAlbumDetail,
  getDatabase,
  listAlbums,
  searchAlbums,
} from '@vgm/core';
import { getCosBaseUrl } from '@vgm/core';
import { NotFoundError } from '@vgm/shared';
import type { FastifyInstance } from 'fastify';

import type { RouteContext } from './types.js';

const SAFE_ID = { type: 'string' as const, pattern: '^[a-zA-Z0-9_-]+$' };

function buildCoverUrl(config: RouteContext['config'], albumId: string, baseUrl: string): string {
  if (config.mediaSource === 'cos' && config.cosBucket && config.cosRegion) {
    return getCosBaseUrl(config.cosBucket, config.cosRegion, `covers/${albumId}.png`);
  }
  return `${baseUrl}/api/assets/${albumId}/cover`;
}

export async function albumRoutes(app: FastifyInstance, { config }: RouteContext) {
  app.get('/api/albums/search', {
    schema: {
      querystring: {
        type: 'object' as const,
        properties: {
          q: { type: 'string' as const },
          artist: { type: 'string' as const },
          genre: { type: 'string' as const },
          year: { type: 'integer' as const, minimum: 0 },
          seriesId: SAFE_ID,
          limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer' as const, minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const context = await getDatabase(config);
    const { q, artist, genre, year, seriesId, limit, offset } = request.query as {
      q?: string;
      artist?: string;
      genre?: string;
      year?: number;
      seriesId?: string;
      limit?: number;
      offset?: number;
    };

    const result = await searchAlbums(context, {
      q,
      artist,
      genre,
      year,
      seriesId,
      limit: limit ?? 20,
      offset: offset ?? 0,
    });

    const baseUrl = config.baseUrl ?? `${request.protocol}://${request.headers.host}`;
    return {
      ...result,
      items: result.items.map((album) => ({
        ...album,
        coverUrl: buildCoverUrl(config, album.publicId, baseUrl),
      })),
    };
  });

  app.get('/api/albums', async (request) => {
    const context = await getDatabase(config);
    const albums = listAlbums(context);
    const baseUrl = config.baseUrl ?? `${request.protocol}://${request.headers.host}`;
    return albums.map((album) => ({
      ...album,
      coverUrl: buildCoverUrl(config, album.publicId, baseUrl),
    }));
  });

  app.get('/api/albums/:id', {
    schema: { params: { type: 'object' as const, properties: { id: SAFE_ID }, required: ['id'] } },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const context = await getDatabase(config);
    const album = await getAlbumDetail(context, id);

    if (!album) {
      throw new NotFoundError('Album', id);
    }

    const baseUrl = config.baseUrl ?? `${request.protocol}://${request.headers.host}`;
    return {
      ...album,
      coverUrl: buildCoverUrl(config, album.publicId, baseUrl),
    };
  });

  app.get('/api/albums/:id/tracks', {
    schema: { params: { type: 'object' as const, properties: { id: SAFE_ID }, required: ['id'] } },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const context = await getDatabase(config);
    const album = await getAlbumDetail(context, id);

    if (!album) {
      throw new NotFoundError('Album', id);
    }

    return album.tracks;
  });
}
