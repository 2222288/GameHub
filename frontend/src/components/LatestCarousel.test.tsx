import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LatestCarousel } from './LatestCarousel';
import type { GameCard } from '@/types';

const games: GameCard[] = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  name: `New Game ${index + 1}`,
  slug: `new-${index + 1}`,
  summary: 'Recently updated',
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
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

it('exposes one full banner with a matching dot for each game', () => {
  const { container } = renderCarousel();
  expect(container.querySelectorAll('.latest-slide')).toHaveLength(games.length);
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/games/new-1');
  expect(screen.getByRole('img').getAttribute('src')).toBe('/banner-1.jpg');
  expect(dot(1).getAttribute('aria-current')).toBe('true');
});

it('wraps previous and next and lets dots and keyboard select individual covers', () => {
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

it('pauses auto rotation while hovered, focused or explicitly stopped', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  renderCarousel();
  fireEvent.mouseEnter(screen.getByRole('region'));
  vi.advanceTimersByTime(6000);
  expect(dot(1).getAttribute('aria-current')).toBe('true');
  fireEvent.focus(screen.getByRole('link'));
  fireEvent.mouseLeave(screen.getByRole('region'));
  vi.advanceTimersByTime(6000);
  expect(dot(1).getAttribute('aria-current')).toBe('true');
  fireEvent.blur(screen.getByRole('link'), { relatedTarget: document.body });
  fireEvent.click(screen.getByRole('button', { name: '暂停自动切换' }));
  vi.advanceTimersByTime(6000);
  expect(dot(1).getAttribute('aria-current')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '继续自动切换' }));
  act(() => vi.advanceTimersByTime(5200));
  expect(dot(2).getAttribute('aria-current')).toBe('true');
});

it('respects reduced motion without starting an automatic timer', () => {
  vi.useFakeTimers();
  renderCarousel();
  vi.advanceTimersByTime(12000);
  expect(dot(1).getAttribute('aria-current')).toBe('true');
  expect(screen.queryByRole('button', { name: '暂停自动切换' })).toBeNull();
});
