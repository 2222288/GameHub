import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Artwork } from './Artwork';
afterEach(cleanup);
it('retries a new image URL after the previous image failed', () => {
  const { rerender } = render(<Artwork url="/missing.jpg" name="Game" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img').tagName).toBe('DIV');
  rerender(<Artwork url="/new.jpg" name="Game" />);
  expect(screen.getByRole('img').tagName).toBe('IMG');
  expect(screen.getByRole('img').getAttribute('src')).toBe('/new.jpg');
});

it('falls back from a failed banner to its cover, then to placeholder artwork', () => {
  render(<Artwork url="/banner.jpg" fallbackUrl="/cover.jpg" name="Game" />);
  expect(screen.getByRole('img').getAttribute('src')).toBe('/banner.jpg');
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img').getAttribute('src')).toBe('/cover.jpg');
  expect(screen.getByRole('img').hasAttribute('data-fallback')).toBe(true);
  expect((screen.getByRole('img') as HTMLImageElement).style.objectFit).toBe('contain');
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img').tagName).toBe('DIV');
});
