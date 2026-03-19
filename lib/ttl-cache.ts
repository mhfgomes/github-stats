interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const cacheStores = new Map<string, Map<string, CacheEntry<unknown>>>();

function getStore(name: string) {
  if (!cacheStores.has(name)) {
    cacheStores.set(name, new Map());
  }
  return cacheStores.get(name)!;
}

export function getTtlCacheValue<T>(storeName: string, key: string): T | undefined {
  const store = getStore(storeName);
  const entry = store.get(key);

  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }

  return entry.value as T;
}

export function setTtlCacheValue<T>(
  storeName: string,
  key: string,
  value: T,
  ttlMs: number
) {
  const store = getStore(storeName);
  store.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}
