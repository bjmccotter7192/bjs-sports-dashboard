import { fetchAll } from './fetch-all';

describe('fetchAll', () => {
  it('fetches each unique key once', async () => {
    const fetch = vi.fn((k: string) => Promise.resolve(k.toUpperCase()));
    const result = await fetchAll(['a', 'b', 'a'], fetch, '');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.get('a')).toBe('A');
    expect(result.get('b')).toBe('B');
  });

  it('uses the fallback for a failed key without failing the others', async () => {
    const fetch = (k: string) => k === 'bad' ? Promise.reject(new Error('400')) : Promise.resolve(k);
    const result = await fetchAll(['ok', 'bad'], fetch, 'fallback');
    expect(result.get('ok')).toBe('ok');
    expect(result.get('bad')).toBe('fallback');
  });

  it('returns an empty map for no keys', async () => {
    const result = await fetchAll([], () => Promise.resolve(1), 0);
    expect(result.size).toBe(0);
  });
});
