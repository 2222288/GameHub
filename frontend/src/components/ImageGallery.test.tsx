import {afterEach, expect, it} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {ImageGallery} from './ImageGallery';
const items = [
  {id: 1, type: 'SCREENSHOT', url: 'placeholder://one', sortOrder: 1},
  {id: 2, type: 'SCREENSHOT', url: 'placeholder://two', sortOrder: 2},
];
afterEach(cleanup);
it('supports keyboard image navigation and restores focus after Escape', async () => {
  render(<ImageGallery items={items} name="Game" />);
  const trigger = screen.getByRole('button', {name: '查看 Game 截图 1'});
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog');
  fireEvent.keyDown(dialog, {key: 'ArrowRight'});
  expect(screen.getByRole('status').textContent).toBe('2 / 2');
  fireEvent.keyDown(dialog, {key: 'ArrowRight'});
  expect(screen.getByRole('status').textContent).toBe('1 / 2');
  fireEvent.keyDown(dialog, {key: 'Escape'});
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
it('removes an open image if the gallery data is cleared', async () => {
  const {rerender} = render(<ImageGallery items={items} name="Game" />);
  fireEvent.click(screen.getByRole('button', {name: '查看 Game 截图 2'}));
  expect(await screen.findByRole('dialog')).toBeTruthy();
  rerender(<ImageGallery items={[]} name="Game" />);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
