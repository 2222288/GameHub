import { expect, it } from 'vitest';
import { normalizeGamePayload } from './gamePayload';
it('sends blank optional dates as null without mutating a saved form', () => {
  const form = { releaseDate: '', versionUpdateDate: '  ', name: 'Game', categoryId: 1 };
  expect(normalizeGamePayload(form)).toEqual({
    ...form,
    releaseDate: null,
    versionUpdateDate: null,
  });
  expect(form.releaseDate).toBe('');
});
it('preserves selected dates and other fields', () => {
  const form = { releaseDate: '2026-10-12', versionUpdateDate: '2026-10-01', description: '' };
  expect(normalizeGamePayload(form)).toEqual(form);
});
