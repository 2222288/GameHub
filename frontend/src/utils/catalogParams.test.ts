import { describe, expect, it } from 'vitest';
import { catalogParams, positiveInteger } from './catalogParams';
describe('URL pagination inputs', () => {
  it.each(['NaN', 'Infinity', '-1', '0', '1.5', '9999999999999999999999', '1e3'])(
    'rejects malformed page %s',
    (value) => {
      expect(positiveInteger(value, 1)).toBe(1);
    },
  );
  it('limits oversized pages and invalid sort / size values', () => {
    const { params } = catalogParams(
      new URLSearchParams('page=2000000&size=-20&sort=garbage&category=Infinity'),
    );
    expect(params).toMatchObject({
      page: 1_000_000,
      size: 20,
      sort: 'updated',
      category: undefined,
    });
  });
  it('preserves keyword filtering and search relevance', () => {
    const { params } = catalogParams(
      new URLSearchParams('tag=RPG&platform=Windows&language=English'),
      true,
    );
    expect(params).toMatchObject({
      tag: 'RPG',
      platform: 'Windows',
      language: 'English',
      sort: 'relevance',
    });
  });
});
