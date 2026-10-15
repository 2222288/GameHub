import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LatestCarousel } from './LatestCarousel';
import type { GameCard } from '@/types';

const games: GameCard[] = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  name: `New Game ${index + 1}`,
  slug: `new-${index + 1}`,
  summary: 'Featured game',
  bannerUrl: `/banner-${index + 1}.jpg`,
  coverUrl: `/cover-${index + 1}.jpg`,
  status: 'PUBLISHED',
  updatedAt: '2026-10-13',
  resourceClickCount: 0,
  viewCount: 0,
  tags: [],
  platforms: [],
  languages: [],
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const renderCarousel = (items = games) =>
  render(
    <MemoryRouter>
      <LatestCarousel games={items} />
    </MemoryRouter>,
  );
const dot = (index: number) =>
  screen.getByRole('button', { name: `显示第 ${index} 张封面：New Game ${index}` });

it('exposes one active wide banner with a matching dot for each game', () => {
  const { container } = renderCarousel();
  expect(container.querySelectorAll('.latest-slide')).toHaveLength(games.length);
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/games/new-1');
  expect(screen.getByRole('img').getAttribute('src')).toBe('/banner-1.jpg');
  expect(dot(1).getAttribute('aria-current')).toBe('true');
  expect(container.querySelector('.latest-item-body')).toBeNull();
  expect(screen.queryByRole('button', { name: /自动切换/ })).toBeNull();
});

it('removes a banner that fails to load instead of showing an artwork fallback', () => {
  renderCarousel();
  const firstImage = screen.getByRole('img', { name: 'New Game 1' });
  fireEvent.error(firstImage);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/games/new-2');
  expect(screen.queryByRole('button', { name: '显示第 1 张封面：New Game 1' })).toBeNull();
  expect(
    screen.getByRole('button', { name: '显示第 1 张封面：New Game 2' }).getAttribute('aria-current'),
  ).toBe('true');
});

it('keeps the same active game when an earlier preloaded banner fails', () => {
  const { container } = renderCarousel();
  fireEvent.click(dot(3));
  const firstImage = container.querySelector<HTMLImageElement>('img[src="/banner-1.jpg"]')!;
  fireEvent.error(firstImage);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/games/new-3');
  expect(
    screen.getByRole('button', { name: '显示第 2 张封面：New Game 3' }).getAttribute('aria-current'),
  ).toBe('true');
});

it('restores focus to the next usable banner when the focused active image fails', () => {
  renderCarousel();
  const link = screen.getByRole('link');
  act(() => link.focus());
  fireEvent.error(screen.getByRole('img', { name: 'New Game 1' }));
  expect(document.activeElement).toBe(screen.getByRole('link'));
  expect(document.activeElement?.getAttribute('href')).toBe('/games/new-2');
});

it('wraps previous and next and lets dots and keyboard select individual banners', () => {
  renderCarousel();
  fireEvent.click(screen.getByRole('button', { name: '上一张封面' }));
  expect(dot(5).getAttribute('aria-current')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '下一张封面' }));
  expect(dot(1).getAttribute('aria-current')).toBe('true');
  fireEvent.click(dot(3));
  expect(screen.getByRole('link').getAttribute('href')).toBe('/games/new-3');
  fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowRight' });
  expect(dot(4).getAttribute('aria-current')).toBe('true');
  fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowLeft' });
  expect(dot(3).getAttribute('aria-current')).toBe('true');
});

it('supports horizontal touch swipes without automatic rotation', () => {
  renderCarousel();
  const region = screen.getByRole('region');
  fireEvent.touchStart(region, { changedTouches: [{ clientX: 180 }] });
  fireEvent.touchEnd(region, { changedTouches: [{ clientX: 80 }] });
  expect(dot(2).getAttribute('aria-current')).toBe('true');

  fireEvent.touchStart(region, { changedTouches: [{ clientX: 80 }] });
  fireEvent.touchEnd(region, { changedTouches: [{ clientX: 180 }] });
  expect(dot(1).getAttribute('aria-current')).toBe('true');
});

it('keeps the selected game in range when refreshed results shrink', () => {
  const { rerender } = renderCarousel();
  fireEvent.click(dot(5));
  rerender(
    <MemoryRouter>
      <LatestCarousel games={games.slice(0, 2)} />
    </MemoryRouter>,
  );
  expect(dot(2).getAttribute('aria-current')).toBe('true');
  expect(screen.getByRole('link').getAttribute('href')).toBe('/games/new-2');
});

it('moves a focused game link to the selected slide after a keyboard change', () => {
  renderCarousel();
  act(() => screen.getByRole('link').focus());
  fireEvent.keyDown(screen.getByRole('link'), { key: 'ArrowRight' });
  expect(document.activeElement).toBe(screen.getByRole('link'));
  expect(document.activeElement?.getAttribute('href')).toBe('/games/new-2');
});

it('renders one game without unnecessary controls and handles an empty result', () => {
  const { rerender } = renderCarousel(games.slice(0, 1));
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.queryByRole('button')).toBeNull();
  rerender(
    <MemoryRouter>
      <LatestCarousel games={[]} />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('region')).toBeNull();
});
