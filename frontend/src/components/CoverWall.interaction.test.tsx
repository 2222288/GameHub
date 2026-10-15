import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoverWall } from './CoverWall';
import type { WallGame } from '@/types';

const games: WallGame[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  name: `Game ${index + 1}`,
  slug: `game-${index + 1}`,
  hue: (index * 30) % 360,
}));

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('fills a tall, narrow wall through the entire animation loop', () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1440);
  const { container } = render(
    <MemoryRouter>
      <CoverWall games={games} />
    </MemoryRouter>,
  );
  const lanes = Array.from(container.querySelectorAll('.wall-column'));
  const tileHeight = (320 / lanes.length) * 1.5;
  for (const lane of lanes) {
    const oneSet = lane.querySelector('.wall-column-set')!;
    expect(oneSet.querySelectorAll('.wall-cover').length * tileHeight).toBeGreaterThanOrEqual(1440);
  }
});

it('marks only the hovered lane as selected, and clears it on pointer leave', () => {
  const { container } = render(
    <MemoryRouter>
      <CoverWall games={games} />
    </MemoryRouter>,
  );
  const lanes = Array.from(container.querySelectorAll('.wall-column'));
  expect(lanes.length).toBeGreaterThan(2);

  fireEvent.pointerEnter(lanes[1]);
  expect(lanes[1].hasAttribute('data-selected')).toBe(true);
  expect(lanes[0].hasAttribute('data-selected')).toBe(false);
  expect(lanes[2].hasAttribute('data-selected')).toBe(false);

  fireEvent.pointerLeave(lanes[1]);
  expect(lanes.every((lane) => !lane.hasAttribute('data-selected'))).toBe(true);
});

it('does not stop other lanes when a game cover receives keyboard focus', () => {
  const { container } = render(
    <MemoryRouter>
      <CoverWall games={games} />
    </MemoryRouter>,
  );
  const lanes = Array.from(container.querySelectorAll('.wall-column'));
  fireEvent.focus(lanes[0].querySelector('a')!);
  expect(lanes[0].hasAttribute('data-selected')).toBe(true);
  expect(lanes.slice(1).every((lane) => !lane.hasAttribute('data-selected'))).toBe(true);
});
