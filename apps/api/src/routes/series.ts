import {
  getDatabase,
  getSeriesDetail,
  listSeries,
} from '@vgm/core';
import { NotFoundError } from '@vgm/shared';
import type { FastifyInstance } from 'fastify';

import type { RouteContext } from './types.js';

export async function seriesRoutes(app: FastifyInstance, { config }: RouteContext) {
  app.get('/api/series', async () => {
    const context = await getDatabase(config);
    return listSeries(context);
  });

  app.get('/api/series/:id', async (request) => {
    const context = await getDatabase(config);
    const series = await getSeriesDetail(context, (request.params as { id: string }).id);

    if (!series) {
      throw new NotFoundError('Series', (request.params as { id: string }).id);
    }

    return series;
  });
}
