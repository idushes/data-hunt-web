export type CachedRecord<T> = {
  cachedAt: string;
  payload: T;
};

export type CacheInfo = {
  cachedAt: string;
  stale: boolean;
};

export const GMTRADE_CACHE_REFRESH_MS = 5 * 60 * 1000;
export const GMTRADE_POOLS_CACHE_KEY = "gmtrade:pools-cache:v1";

export function gmTradePositionsCacheKey(wallet: string) {
  return `gmtrade:positions-cache:v1:${encodeURIComponent(wallet.trim())}`;
}

export function gmTradePoolDetailCacheKey(type: string, mint: string) {
  return `gmtrade:pool-detail-cache:v1:${encodeURIComponent(
    type.toUpperCase()
  )}:${encodeURIComponent(mint.trim())}`;
}

export function readCachedRecord<T>(key: string): CachedRecord<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.cachedAt !== "string") return null;
    if (!("payload" in parsed)) return null;

    return parsed as CachedRecord<T>;
  } catch {
    return null;
  }
}

export function writeCachedRecord<T>(
  key: string,
  payload: T
): CachedRecord<T> | null {
  const record = {
    cachedAt: new Date().toISOString(),
    payload,
  };

  try {
    localStorage.setItem(key, JSON.stringify(record));
    return record;
  } catch {
    return null;
  }
}

export function cacheInfo(
  record: CachedRecord<unknown>,
  stale: boolean
): CacheInfo {
  return {
    cachedAt: record.cachedAt,
    stale,
  };
}
