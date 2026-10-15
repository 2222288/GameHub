import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { GameCard } from '@/types';
import { PopularDownloads } from './PopularDownloads';

const game = (id: number, name: string): GameCard => ({
  id,
  name,
  slug: `game-${id}`,
  summary: '简介',
  status: 'PUBLISHED',
  viewCount: 0,
  resourceClickCount: 10,
  updatedAt: '2026-10-15',
  tags: [],
  platforms: [],
  languages: [],
});

afterEach(cleanup);

it('keeps pure Chinese titles upright and uses sideways text for mixed or Latin names', () => {
  const { container } = render(
    <MemoryRouter>
      <PopularDownloads
        games={[game(1, '星港余烬'), game(2, '最终幻想 VII Remake'), game(3, 'Neon Divide')]}
      />
    </MemoryRouter>,
  );
  const bands = Array.from(container.querySelectorAll('.popular-name-band'));
  expect(bands[0].classList.contains('popular-name-band-sideways')).toBe(false);
  expect(bands[1].classList.contains('popular-name-band-sideways')).toBe(true);
  expect(bands[2].classList.contains('popular-name-band-sideways')).toBe(true);
});
