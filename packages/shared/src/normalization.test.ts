import { describe, expect, it } from 'vitest';

import { compareTrackOrder, parseTagNumber } from './normalization.js';

describe('normalization helpers', () => {
  it('parses track numbers from tag values', () => {
    expect(parseTagNumber('3/24')).toBe(3);
    expect(parseTagNumber(7)).toBe(7);
    expect(parseTagNumber(undefined)).toBeUndefined();
  });

  it('sorts by disc then track then path', () => {
    const tracks = [
      { discNumber: 2, trackNumber: 1, relativePath: 'b.mp3' },
      { discNumber: 1, trackNumber: 2, relativePath: 'c.mp3' },
      { discNumber: 1, trackNumber: 1, relativePath: 'a.mp3' },
    ];

    tracks.sort(compareTrackOrder);

    expect(tracks.map((track) => track.relativePath)).toEqual(['a.mp3', 'c.mp3', 'b.mp3']);
  });
});
