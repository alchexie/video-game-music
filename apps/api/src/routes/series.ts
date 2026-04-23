import {
  getDatabase,
  getSeriesDetail,
  getCosBaseUrl,
  listSeries,
} from '@vgm/core';
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

export async function seriesRoutes(app: FastifyInstance, { config }: RouteContext) {
  app.get('/api/series', async () => {
    const context = await getDatabase(config);
    return listSeries(context);
  });

  app.get('/api/series/:id', {
    schema: { params: { type: 'object' as const, properties: { id: SAFE_ID }, required: ['id'] } },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const context = await getDatabase(config);
    const series = await getSeriesDetail(context, id);

    if (!series) {
      throw new NotFoundError('Series', id);
    }

    const baseUrl = config.baseUrl ?? `${request.protocol}://${request.headers.host}`;
    return {
      ...series,
      albums: series.albums.map((album) => ({
        ...album,
        coverUrl: buildCoverUrl(config, album.publicId, baseUrl),
      })),
    };
  });
}
