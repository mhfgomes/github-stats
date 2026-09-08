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

const inflight = new Map<string, Promise<unknown>>();

/**
 * Return a cached value, or run `factory` once and store the result.
 * Concurrent callers for the same key share a single in-flight promise so
 * GitHub walks are not duplicated while the first request is still running.
 */
export async function getOrSetTtlCacheValue<T>(
  storeName: string,
  key: string,
  ttlMs: number,
  factory: () => Promise<T>
): Promise<T> {
  const cached = getTtlCacheValue<T>(storeName, key);
  if (cached !== undefined) return cached;

  const inflightKey = `${storeName}\0${key}`;
  const existing = inflight.get(inflightKey);
  if (existing) return existing as Promise<T>;

  const promise = factory()
    .then((value) => {
      setTtlCacheValue(storeName, key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inflight.delete(inflightKey);
    });

  inflight.set(inflightKey, promise);
  return promise;
}
