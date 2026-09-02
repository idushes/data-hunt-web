"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/landing/Header";
import {
  isRaydiumCacheFresh,
  RAYDIUM_CACHE_REFRESH_MS,
  RAYDIUM_POOLS_CACHE_KEY,
  readRaydiumCache,
  writeRaydiumCache,
} from "@/app/raydium/cache";
import { raydiumPoolUrl } from "@/app/raydium/links";
import type {
  RaydiumApiError,
  RaydiumPool,
  RaydiumPoolsResponse,
  RaydiumPoolType,
} from "@/app/raydium/types";

type TypeFilter = "All" | RaydiumPoolType;
type SortKey = "tvl" | "volume" | "apr24h" | "apr7d" | "apr30d";

const FAVORITES_KEY = "raydium:favorites:v1";

function formatUsd(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1_000 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

function formatFeeRate(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toLocaleString("en-US", {
    maximumFractionDigits: 3,
  })}%`;
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;
}

function typeTone(type: RaydiumPoolType) {
  return type === "Concentrated"
    ? "border-violet-400/30 bg-violet-400/10 text-violet-200"
    : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
}

function sortValue(pool: RaydiumPool, key: SortKey) {
  if (key === "volume") return pool.day.volume;
  if (key === "apr24h") return pool.day.apr;
  if (key === "apr7d") return pool.week.apr;
  if (key === "apr30d") return pool.month.apr;
  return pool.tvl;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="m12 3 2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.79l-5.4 2.84 1.03-6.02L3.26 9.35l6.04-.88L12 3Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RaydiumPage() {
  const [data, setData] = useState<RaydiumPoolsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cacheNotice, setCacheNotice] = useState("");
  const [cachedAt, setCachedAt] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [minimumTvl, setMinimumTvl] = useState("");
  const [rewardsOnly, setRewardsOnly] = useState(false);
  const [rwaOnly, setRwaOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("tvl");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setCacheNotice("");

    try {
      const response = await fetch(
        "/api/raydium?size=200&sortField=liquidity&sortType=desc",
        { cache: "no-store" }
      );
      const payload = (await response.json()) as
        | RaydiumPoolsResponse
        | RaydiumApiError;

      if (!response.ok || !("rows" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Failed to load Raydium pools."
        );
      }

      setData(payload);
      const cached = writeRaydiumCache(RAYDIUM_POOLS_CACHE_KEY, payload);
      setCachedAt(cached?.cachedAt ?? payload.fetchedAt);
    } catch (caught) {
      const cached = readRaydiumCache<RaydiumPoolsResponse>(
        RAYDIUM_POOLS_CACHE_KEY
      );
      if (cached) {
        setData(cached.payload);
        setCachedAt(cached.cachedAt);
        setCacheNotice(
          "Raydium is temporarily unavailable. Showing the latest cached pool data."
        );
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to load Raydium pools."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
      if (Array.isArray(stored)) {
        setFavorites(new Set(stored.filter((item) => typeof item === "string")));
      }
    } catch {
      setFavorites(new Set());
    }

    const cached = readRaydiumCache<RaydiumPoolsResponse>(
      RAYDIUM_POOLS_CACHE_KEY
    );
    if (cached) {
      setData(cached.payload);
      setCachedAt(cached.cachedAt);
    }
    if (!cached || !isRaydiumCacheFresh(cached)) void loadData();

    const interval = window.setInterval(loadData, RAYDIUM_CACHE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadData]);

  const rows = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const minimum = Number(minimumTvl);

    return data.rows
      .filter((pool) => {
        const pair = `${pool.mintA.symbol}/${pool.mintB.symbol}`.toLowerCase();
        const matchesQuery =
          !normalizedQuery ||
          pair.includes(normalizedQuery) ||
          pool.id.toLowerCase().includes(normalizedQuery) ||
          pool.mintA.address.toLowerCase().includes(normalizedQuery) ||
          pool.mintB.address.toLowerCase().includes(normalizedQuery);
        const matchesType = typeFilter === "All" || pool.type === typeFilter;
        const matchesMinimum = !minimumTvl || pool.tvl >= minimum;
        const matchesRewards = !rewardsOnly || pool.hasRewards;
        const matchesRwa = !rwaOnly || pool.isRwa;
        const matchesFavorites = !favoritesOnly || favorites.has(pool.id);
        return (
          matchesQuery &&
          matchesType &&
          matchesMinimum &&
          matchesRewards &&
          matchesRwa &&
          matchesFavorites
        );
      })
      .sort((left, right) => sortValue(right, sortKey) - sortValue(left, sortKey));
  }, [data, favorites, favoritesOnly, minimumTvl, query, rewardsOnly, rwaOnly, sortKey, typeFilter]);

  const visibleSummary = useMemo(
    () => ({
      tvl: rows.reduce((sum, pool) => sum + pool.tvl, 0),
      volume: rows.reduce((sum, pool) => sum + pool.day.volume, 0),
      rewards: rows.filter((pool) => pool.hasRewards).length,
    }),
    [rows]
  );

  const toggleFavorite = useCallback((poolId: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(poolId)) next.delete(poolId);
      else next.add(poolId);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-24 md:px-6">
        <section className="border-b border-white/10 pb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
                Raydium · Solana
              </p>
              <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
                Liquidity Pools
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                Compare standard and concentrated pools by liquidity, volume,
                fees, and indicative APR.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFavoritesOnly((value) => !value)}
                aria-pressed={favoritesOnly}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors ${
                  favoritesOnly
                    ? "border-amber-300 bg-amber-300 text-black"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <StarIcon filled={favoritesOnly} />
                Favorites
              </button>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Loading" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_auto_150px_110px_170px_160px]">
            <label className="sr-only" htmlFor="raydium-search">
              Search Raydium pools
            </label>
            <input
              id="raydium-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pair, pool, or token address"
              className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="grid grid-cols-3 gap-2">
              {(["All", "Concentrated", "Standard"] as TypeFilter[]).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTypeFilter(value)}
                    className={`min-h-11 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      typeFilter === value
                        ? "border-violet-400 bg-violet-400 text-black"
                        : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    {value === "Concentrated" ? "CLMM" : value}
                  </button>
                )
              )}
            </div>
            <label className="sr-only" htmlFor="raydium-min-tvl">
              Minimum TVL
            </label>
            <input
              id="raydium-min-tvl"
              type="number"
              min="0"
              value={minimumTvl}
              onChange={(event) => setMinimumTvl(event.target.value)}
              placeholder="Minimum TVL"
              className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500"
            />
            <button
              type="button"
              onClick={() => setRwaOnly((value) => !value)}
              aria-pressed={rwaOnly}
              className={`min-h-11 rounded-lg border px-4 text-sm font-semibold transition-colors ${
                rwaOnly
                  ? "border-sky-300 bg-sky-300 text-black"
                  : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              RWA
            </button>
            <button
              type="button"
              onClick={() => setRewardsOnly((value) => !value)}
              aria-pressed={rewardsOnly}
              className={`min-h-11 rounded-lg border px-4 text-sm font-semibold transition-colors ${
                rewardsOnly
                  ? "border-emerald-300 bg-emerald-300 text-black"
                  : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              Active rewards
            </button>
            <label className="sr-only" htmlFor="raydium-sort">
              Sort pools
            </label>
            <select
              id="raydium-sort"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-200 outline-none focus:border-violet-500"
            >
              <option value="tvl">Sort: TVL</option>
              <option value="volume">Sort: 24H volume</option>
              <option value="apr24h">Sort: 24H APR</option>
              <option value="apr7d">Sort: 7D APR</option>
              <option value="apr30d">Sort: 30D APR</option>
            </select>
          </div>
        </section>

        {data && (
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Visible pools</p>
              <p className="mt-2 text-2xl font-semibold text-white">{rows.length}</p>
              <p className="mt-1 text-xs text-zinc-600">of {data.rows.length} loaded</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Visible TVL</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(visibleSummary.tvl)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">24H volume</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(visibleSummary.volume)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Reward pools</p>
              <p className="mt-2 text-2xl font-semibold text-white">{visibleSummary.rewards}</p>
            </div>
          </section>
        )}

        {data && (
          <div className="mt-4 flex flex-col gap-1 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
            <span>APR is indicative and can differ from an individual LP position.</span>
            <span>
              {cacheNotice ? "Cached" : "Updated"} {formatTimestamp(cachedAt || data.fetchedAt)}
              {loading ? " · refreshing" : ""}
            </span>
          </div>
        )}

        {cacheNotice && (
          <section className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {cacheNotice}
          </section>
        )}
        {error && (
          <section className="mt-8 rounded-lg border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
            {error}
          </section>
        )}
        {loading && !data && (
          <section className="mt-10 flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          </section>
        )}
        {!loading && data && rows.length === 0 && (
          <section className="mt-8 rounded-lg border border-white/10 bg-zinc-950/70 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-white">No matching pools</p>
            <p className="mt-2 text-sm text-zinc-500">Try a broader search or remove a filter.</p>
          </section>
        )}

        {rows.length > 0 && (
          <section className="mt-8 overflow-hidden rounded-lg border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead className="bg-zinc-950 text-xs uppercase tracking-[0.12em] text-zinc-500">
                  <tr>
                    <th className="w-12 px-4 py-3 font-medium">Fav</th>
                    <th className="px-4 py-3 font-medium">Pool</th>
                    <th className="px-4 py-3 font-medium">TVL</th>
                    <th className="px-4 py-3 font-medium">24H volume</th>
                    <th className="px-4 py-3 font-medium">Fee</th>
                    <th className="px-4 py-3 font-medium">24H APR</th>
                    <th className="px-4 py-3 font-medium">7D APR</th>
                    <th className="px-4 py-3 font-medium">30D APR</th>
                    <th className="px-4 py-3 font-medium">Rewards</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-black">
                  {rows.map((pool) => (
                    <tr key={pool.id} className="transition-colors hover:bg-zinc-950">
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(pool.id)}
                          aria-pressed={favorites.has(pool.id)}
                          aria-label={`${favorites.has(pool.id) ? "Remove" : "Add"} ${pool.mintA.symbol}/${pool.mintB.symbol} ${favorites.has(pool.id) ? "from" : "to"} favorites`}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                            favorites.has(pool.id)
                              ? "border-amber-300/60 bg-amber-300/15 text-amber-200"
                              : "border-zinc-800 text-zinc-600 hover:text-amber-200"
                          }`}
                        >
                          <StarIcon filled={favorites.has(pool.id)} />
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <a
                          href={raydiumPoolUrl(pool.type, pool.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                        >
                          <span className={`rounded border px-2 py-1 text-[11px] font-semibold ${typeTone(pool.type)}`}>
                            {pool.type === "Concentrated" ? "CLMM" : "Standard"}
                          </span>
                          <span>
                            <span className="block font-semibold text-white group-hover:text-violet-200">
                              {pool.mintA.symbol}/{pool.mintB.symbol}
                              {pool.isRwa && (
                                <span className="ml-2 rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">
                                  RWA
                                </span>
                              )}
                            </span>
                            <span className="block font-mono text-xs text-zinc-600">{shortAddress(pool.id)}</span>
                          </span>
                        </a>
                      </td>
                      <td className="px-4 py-4 font-mono text-zinc-200">{formatUsd(pool.tvl)}</td>
                      <td className="px-4 py-4 font-mono text-zinc-300">{formatUsd(pool.day.volume)}</td>
                      <td className="px-4 py-4 font-mono text-zinc-300">{formatFeeRate(pool.feeRate)}</td>
                      <td className="px-4 py-4 font-mono text-emerald-300">{formatPercent(pool.day.apr)}</td>
                      <td className="px-4 py-4 font-mono text-emerald-300">{formatPercent(pool.week.apr)}</td>
                      <td className="px-4 py-4 font-mono text-emerald-300">{formatPercent(pool.month.apr)}</td>
                      <td className="px-4 py-4 text-xs text-zinc-400">
                        {pool.rewardSymbols.length > 0 ? pool.rewardSymbols.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/raydium/${pool.id}`}
                          aria-label={`Open ${pool.mintA.symbol}/${pool.mintB.symbol} pool details`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-400/10 text-violet-200 transition-colors hover:bg-violet-400/20"
                        >
                          <ArrowIcon />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
