/**
 * Fetch once per unique key, in parallel. A failed fetch resolves to `fallback`
 * so one broken ESPN endpoint only empties its own panels.
 */
export async function fetchAll<K, V>(
  keys: readonly K[],
  fetch: (key: K) => Promise<V>,
  fallback: V
): Promise<Map<K, V>> {
  const unique = [...new Set(keys)];
  const values = await Promise.all(unique.map(k => fetch(k).catch(() => fallback)));
  return new Map(unique.map((k, i) => [k, values[i]]));
}
