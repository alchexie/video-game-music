import fs from 'node:fs';

import {
  getDatabase,
  getTrackById,
  resolveCoverAsset,
  resolveTrackEmbeddedCover,
  resolveTrackStream,
  searchTracks,
} from '@vgm/core';
import { NotFoundError } from '@vgm/shared';
import type { FastifyInstance } from 'fastify';

import { streamLocalFile } from '../streaming.js';
import type { RouteContext } from './types.js';

export async function trackRoutes(app: FastifyInstance, { config }: RouteContext) {
  app.get('/api/tracks/search', async (request) => {
    const context = await getDatabase(config);
    const { q, album, artist, genre, year, seriesId, discNumber, trackNumber, limit, offset } = request.query as {
      q?: string;
      album?: string;
      artist?: string;
      genre?: string;
      year?: string;
      seriesId?: string;
      discNumber?: string;
      trackNumber?: string;
      limit?: string;
      offset?: string;
    };

    const result = await searchTracks(context, {
      q,
      album,
      artist,
      genre,
      year: year !== undefined ? Number(year) : undefined,
      seriesId,
      discNumber: discNumber !== undefined ? Number(discNumber) : undefined,
      trackNumber: trackNumber !== undefined ? Number(trackNumber) : undefined,
      limit: limit !== undefined ? Number(limit) : 20,
      offset: offset !== undefined ? Number(offset) : 0,
    });

    const baseUrl = config.baseUrl ?? `${request.protocol}://${request.headers.host}`;
    return {
      ...result,
      items: result.items.map((track) => ({
        ...track,
        streamUrl: `${baseUrl}/api/tracks/${track.publicId}/stream`,
        coverUrl: track.coverAssetId ? `${baseUrl}/api/assets/${track.coverAssetId}/cover` : undefined,
      })),
    };
  });

  app.get('/api/tracks/:id', async (request) => {
    const context = await getDatabase(config);
    const track = await getTrackById(context, (request.params as { id: string }).id);

    if (!track) {
      throw new NotFoundError('Track', (request.params as { id: string }).id);
    }

    return track;
  });

  app.get('/api/tracks/:id/stream', async (request, reply) => {
    const context = await getDatabase(config);
    const stream = await resolveTrackStream(context, config, (request.params as { id: string }).id);

    if (!stream) {
      throw new NotFoundError('Track stream', (request.params as { id: string }).id);
    }

    if (stream.mode === 'redirect') {
      reply.header('Cache-Control', 'private, max-age=3600');
      reply.redirect(stream.redirectUrl!);
      return;
    }

    return streamLocalFile(reply, stream.filePath!, stream.mimeType || 'audio/mpeg', request.headers.range);
  });

  app.get('/api/tracks/:id/embedded-cover', async (request, reply) => {
    const context = await getDatabase(config);
    const coverBuffer = await resolveTrackEmbeddedCover(context, config, (request.params as { id: string }).id);
    if (!coverBuffer) {
      throw new NotFoundError('Embedded cover');
    }
    reply.header('Content-Type', 'image/png');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(coverBuffer);
  });

  app.get('/api/assets/:id/cover', async (request, reply) => {
    const context = await getDatabase(config);
    const cover = await resolveCoverAsset(context, config, (request.params as { id: string }).id);

    if (!cover) {
      throw new NotFoundError('Cover', (request.params as { id: string }).id);
    }

    if (cover.mode === 'redirect') {
      reply.redirect(cover.redirectUrl!);
      return;
    }

    reply.header('Content-Type', cover.mimeType || 'image/jpeg');
    return fs.createReadStream(cover.filePath!);
  });
}
