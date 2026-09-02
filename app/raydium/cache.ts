export type RaydiumCachedRecord<T> = {
  cachedAt: string;
  payload: T;
};

export const RAYDIUM_CACHE_REFRESH_MS = 5 * 60 * 1000;
export const RAYDIUM_POOLS_CACHE_KEY = "raydium:pools-cache:v1";

export function raydiumPoolCacheKey(poolId: string) {
  return `raydium:pool-cache:v1:${encodeURIComponent(poolId.trim())}`;
}

export function readRaydiumCache<T>(key: string): RaydiumCachedRecord<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.cachedAt !== "string" || !("payload" in parsed)) return null;
    return parsed as RaydiumCachedRecord<T>;
  } catch {
    return null;
  }
}

export function writeRaydiumCache<T>(
  key: string,
  payload: T
): RaydiumCachedRecord<T> | null {
  const record = { cachedAt: new Date().toISOString(), payload };

  try {
    localStorage.setItem(key, JSON.stringify(record));
    return record;
  } catch {
    return null;
  }
}

export function isRaydiumCacheFresh(
  record: RaydiumCachedRecord<unknown>,
  maxAgeMs = RAYDIUM_CACHE_REFRESH_MS
) {
  const cachedAt = Date.parse(record.cachedAt);
  return Number.isFinite(cachedAt) && Date.now() - cachedAt < maxAgeMs;
}
