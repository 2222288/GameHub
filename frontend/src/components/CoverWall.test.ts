import { describe, expect, it } from 'vitest';
import type { WallGame } from '@/types';
import { buildWallColumns } from './CoverWall';

const games = (count: number, hue: number, prefix: string): WallGame[] =>
  Array.from({ length: count }, (_, index) => ({
    id: Number(`${Math.round(hue) + 1}${index + 1}`),
    name: `${prefix} ${index + 1}`,
    slug: `${prefix}-${index + 1}`,
    hue,
  }));

describe('buildWallColumns', () => {
  it('keeps dense colour groups near the centre while speed follows slow-fast-slow-fast-slow', () => {
    const columns = buildWallColumns(
      [...games(18, 215, 'blue'), ...games(4, 25, 'orange'), ...games(4, 305, 'purple')],
      9,
    );

    expect(columns).toHaveLength(9);
    expect(columns[4].items.every((game) => game.hue === 215)).toBe(true);
    expect(columns[0].speedPxPerSecond).toBeLessThan(columns[2].speedPxPerSecond);
    expect(columns[4].speedPxPerSecond).toBeLessThan(columns[2].speedPxPerSecond);
    expect(columns[4].speedPxPerSecond).toBeLessThan(columns[6].speedPxPerSecond);
    expect(columns[8].speedPxPerSecond).toBeLessThan(columns[6].speedPxPerSecond);
    expect(columns.every((column) => column.items.length >= 6)).toBe(true);
  });

  it('normalizes an even requested count to an odd lane count', () => {
    const columns = buildWallColumns(games(16, 215, 'blue'), 4);
    expect(columns).toHaveLength(5);
  });

  it('keeps analysed grayscale covers in a neutral lane', () => {
    const neutral = games(4, 0, 'neutral').map((game) => ({ ...game, chroma: 0.01 }));
    const columns = buildWallColumns(
      [...games(8, 215, 'blue'), ...neutral, ...games(2, 25, 'orange')],
      5,
    );

    expect(
      columns.some((column) => column.items.every((game) => game.name.startsWith('neutral'))),
    ).toBe(true);
  });
});
