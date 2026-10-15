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
  it('gives the dense colour group the central and faster lanes', () => {
    const columns = buildWallColumns(
      [...games(10, 215, 'blue'), ...games(2, 25, 'orange'), ...games(2, 305, 'purple')],
      5,
    );

    expect(columns).toHaveLength(5);
    expect(columns[2].items.every((game) => game.hue === 215)).toBe(true);
    expect(columns[2].duration).toBeLessThan(columns[0].duration);
    expect(columns.every((column) => column.items.length >= 6)).toBe(true);
  });

  it('keeps analysed grayscale covers in a neutral lane', () => {
    const neutral = games(4, 0, 'neutral').map((game) => ({ ...game, chroma: 0.01 }));
    const columns = buildWallColumns(
      [...games(8, 215, 'blue'), ...neutral, ...games(2, 25, 'orange')],
      4,
    );

    expect(
      columns.some((column) => column.items.every((game) => game.name.startsWith('neutral'))),
    ).toBe(true);
  });
});
