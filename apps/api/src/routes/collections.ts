import {
  addTracksToCollection,
  createCollection,
  getCollectionDetail,
  getDatabase,
  listCollections,
  patchCollection,
} from '@vgm/core';
import { NotFoundError, addCollectionTracksSchema, createCollectionSchema, patchCollectionSchema } from '@vgm/shared';
import type { FastifyInstance } from 'fastify';
import { v7 as uuidv7 } from 'uuid';

import type { RouteContext } from './types.js';

export async function collectionRoutes(app: FastifyInstance, { config }: RouteContext) {
  app.get('/api/collections', async () => {
    const context = await getDatabase(config);
    return listCollections(context);
  });

  app.get('/api/collections/:id', async (request) => {
    const context = await getDatabase(config);
    const collection = await getCollectionDetail(context, (request.params as { id: string }).id);

    if (!collection) {
      throw new NotFoundError('Collection', (request.params as { id: string }).id);
    }

    return collection;
  });

  // --- Admin ---

  app.post('/api/admin/collections', async (request) => {
    const context = await getDatabase(config);
    const input = createCollectionSchema.parse(request.body);

    return createCollection(context, {
      publicId: uuidv7(),
      title: input.title,
      description: input.description,
      status: input.status,
    });
  });

  app.patch('/api/admin/collections/:id', async (request) => {
    const context = await getDatabase(config);
    const input = patchCollectionSchema.parse(request.body);
    const collection = await patchCollection(context, (request.params as { id: string }).id, input);

    if (!collection) {
      throw new NotFoundError('Collection', (request.params as { id: string }).id);
    }

    return collection;
  });

  app.post('/api/admin/collections/:id/tracks', async (request) => {
    const context = await getDatabase(config);
    const input = addCollectionTracksSchema.parse(request.body);
    return addTracksToCollection(context, (request.params as { id: string }).id, input.trackIds);
  });
}
