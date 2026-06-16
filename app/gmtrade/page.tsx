"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/landing/Header";

type PoolType = "GM" | "GLV";
type PeriodKey = "1d" | "7d" | "30d" | "90d";
type PoolTypeFilter = "ALL" | PoolType;

type PeriodReturns = Record<PeriodKey, number | null>;

type PoolRow = {
  type: PoolType;
  mint: string;
  name: string;
  price_usd: number;
  supply: number;
  liquidity_usd: number;
  period_returns: PeriodReturns;
  long_token_mint: string;
  short_token_mint: string;
  index_token_mint: string;
  updated_at: string;
};

type PoolsResponse = {
  mode: "pools";
  periods: PeriodKey[];
  rows: PoolRow[];
  summary: {
    pool_count: number;
    gm_count: number;
    glv_count: number;
    total_liquidity_usd: number;
    weighted_returns: PeriodReturns;
    best_returns: PeriodReturns;
    updated_at: string;
  };
};

type ApiError = {
  error: string;
};

const PERIODS: PeriodKey[] = ["1d", "7d", "30d", "90d"];
const FAVORITES_STORAGE_KEY = "gmtrade:favorites:v1";

function shortAddress(value: string) {
  if (!value) return "";
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value);
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1 ? 2 : 6,
  });
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 4 : 8,
  });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function formatTimestamp(value: string) {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function returnTone(value: number | null) {
  if (value === null) return "text-zinc-500";
  if (value < 0) return "text-red-300";
  if (value > 0) return "text-emerald-300";
  return "text-zinc-300";
}

function poolTypeTone(type: PoolType) {
  return type === "GM"
    ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
    : "border-amber-300/30 bg-amber-300/10 text-amber-100";
}

function favoriteKey(type: PoolType, mint: string) {
  return `${type}:${mint}`;
}

function favoriteKeyForRow(row: PoolRow) {
  return favoriteKey(row.type, row.mint);
}

function storedFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set<string>();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();

    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
}

function persistFavorites(favorites: Set<string>) {
  try {
    localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(Array.from(favorites).sort())
    );
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m11.48 3.5 2.52 5.1 5.63.82-4.07 3.96.96 5.6-5.04-2.65-5.03 2.65.96-5.6-4.07-3.96 5.63-.82 2.51-5.1Z"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export default function GMTradePage() {
  const [data, setData] = useState<PoolsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PoolTypeFilter>("ALL");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const loadPools = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/gmtrade", { cache: "no-store" });
      const payload = (await response.json()) as PoolsResponse | ApiError;

      if (!response.ok) {
        const message =
          "error" in payload && payload.error
            ? payload.error
            : "Failed to load GMTRADE pools.";
        throw new Error(message);
      }

      setData(payload as PoolsResponse);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to load GMTRADE pools.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPools();
  }, [loadPools]);

  useEffect(() => {
    setFavorites(storedFavorites());
  }, []);

  const toggleFavorite = useCallback((row: PoolRow) => {
    setFavorites((current) => {
      const next = new Set(current);
      const key = favoriteKeyForRow(row);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      persistFavorites(next);
      return next;
    });
  }, []);

  const favoritePoolCount = useMemo(() => {
    if (!data) return favorites.size;

    return data.rows.filter((row) => favorites.has(favoriteKeyForRow(row))).length;
  }, [data, favorites]);

  const filteredRows = useMemo(() => {
    if (!data) return [];

    const normalizedQuery = query.trim().toLowerCase();

    return data.rows.filter((row) => {
      const matchesType = typeFilter === "ALL" || row.type === typeFilter;
      const matchesFavorite =
        !favoritesOnly || favorites.has(favoriteKeyForRow(row));
      const matchesQuery =
        !normalizedQuery ||
        row.name.toLowerCase().includes(normalizedQuery) ||
        row.mint.toLowerCase().includes(normalizedQuery);

      return matchesType && matchesFavorite && matchesQuery;
    });
  }, [data, favorites, favoritesOnly, query, typeFilter]);

  const summaryItems = useMemo(() => {
    if (!data) return [];

    return [
      {
        label: "Pools",
        value: String(data.summary.pool_count),
        subvalue: `${data.summary.gm_count} GM / ${data.summary.glv_count} GLV`,
        tone: "text-white",
      },
      {
        label: "Liquidity",
        value: formatUsd(data.summary.total_liquidity_usd),
        subvalue: "Supply × current price",
        tone: "text-white",
      },
      {
        label: "Weighted 7D",
        value: formatPercent(data.summary.weighted_returns["7d"]),
        subvalue: `Best ${formatPercent(data.summary.best_returns["7d"])}`,
        tone: returnTone(data.summary.weighted_returns["7d"]),
      },
      {
        label: "Weighted 30D",
        value: formatPercent(data.summary.weighted_returns["30d"]),
        subvalue: `Best ${formatPercent(data.summary.best_returns["30d"])}`,
        tone: returnTone(data.summary.weighted_returns["30d"]),
      },
    ];
  }, [data]);

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-24 md:px-6">
        <section className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              GMTRADE Solana
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
              Pool Performance
            </h1>
          </div>

          <div className="flex w-full flex-col gap-3 lg:max-w-3xl lg:flex-row">
            <label className="sr-only" htmlFor="gmtrade-search">
              Search pools
            </label>
            <input
              id="gmtrade-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by pool or mint"
              className="min-h-11 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="grid grid-cols-3 gap-2 lg:w-[220px]">
              {(["ALL", "GM", "GLV"] as PoolTypeFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTypeFilter(value)}
                  className={`min-h-11 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                    typeFilter === value
                      ? "border-emerald-400 bg-emerald-400 text-black"
                      : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFavoritesOnly((value) => !value)}
              aria-pressed={favoritesOnly}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                favoritesOnly
                  ? "border-yellow-300 bg-yellow-300 text-black"
                  : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
              }`}
              title="Show favorite pools"
            >
              <StarIcon filled={favoritesOnly} />
              <span>Favorites</span>
            </button>
            <button
              type="button"
              onClick={() => void loadPools()}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Loading" : "Refresh"}
            </button>
          </div>
        </section>

        {data && (
          <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/10 bg-zinc-950/80 p-5"
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  {item.label}
                </p>
                <p className={`mt-3 text-2xl font-semibold ${item.tone}`}>
                  {item.value}
                </p>
                <p className="mt-2 text-xs text-zinc-500">{item.subvalue}</p>
              </div>
            ))}
          </section>
        )}

        {data && (
          <section className="mt-4 flex flex-col gap-2 border-b border-white/10 pb-5 text-sm text-zinc-400 md:flex-row md:items-center md:justify-between">
            <span>
              Showing <span className="text-zinc-200">{filteredRows.length}</span>{" "}
              of <span className="text-zinc-200">{data.rows.length}</span> pools
              {favoritesOnly && (
                <>
                  {" "}
                  · <span className="text-zinc-200">{favoritePoolCount}</span>{" "}
                  favorites
                </>
              )}
            </span>
            <span>
              Source updated{" "}
              <span className="text-zinc-200">
                {formatTimestamp(data.summary.updated_at)}
              </span>
            </span>
          </section>
        )}

        {error && (
          <section className="mt-8 rounded-lg border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
            {error}
          </section>
        )}

        {loading && (
          <section className="mt-10 flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          </section>
        )}

        {!loading && data && filteredRows.length === 0 && (
          <section className="mt-10 rounded-lg border border-white/10 bg-zinc-950/70 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-white">No matching pools</p>
          </section>
        )}

        {!loading && data && filteredRows.length > 0 && (
          <section className="mt-8 overflow-hidden rounded-lg border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
                <thead className="bg-zinc-950 text-xs uppercase tracking-[0.12em] text-zinc-500">
                  <tr>
                    <th className="w-12 px-4 py-3 font-medium">Fav</th>
                    <th className="px-4 py-3 font-medium">Pool</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Liquidity</th>
                    <th className="px-4 py-3 font-medium">1D</th>
                    <th className="px-4 py-3 font-medium">7D</th>
                    <th className="px-4 py-3 font-medium">30D</th>
                    <th className="px-4 py-3 font-medium">90D</th>
                    <th className="px-4 py-3 font-medium">Supply</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">Chart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-black">
                  {filteredRows.map((row) => (
                    <tr key={`${row.type}-${row.mint}`} className="hover:bg-zinc-950">
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(row)}
                          aria-pressed={favorites.has(favoriteKeyForRow(row))}
                          aria-label={
                            favorites.has(favoriteKeyForRow(row))
                              ? `Remove ${row.name} from favorites`
                              : `Add ${row.name} to favorites`
                          }
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                            favorites.has(favoriteKeyForRow(row))
                              ? "border-yellow-300/60 bg-yellow-300/15 text-yellow-200"
                              : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-yellow-300/40 hover:text-yellow-200"
                          }`}
                          title={
                            favorites.has(favoriteKeyForRow(row))
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          <StarIcon filled={favorites.has(favoriteKeyForRow(row))} />
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`rounded border px-2 py-1 text-xs font-semibold ${poolTypeTone(
                              row.type
                            )}`}
                          >
                            {row.type}
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[320px] truncate font-medium text-white">
                              {row.name}
                            </p>
                            <p className="font-mono text-xs text-zinc-500">
                              {shortAddress(row.mint)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-zinc-200">
                        {formatPrice(row.price_usd)}
                      </td>
                      <td className="px-4 py-4 font-mono text-white">
                        {formatUsd(row.liquidity_usd)}
                      </td>
                      {PERIODS.map((period) => (
                        <td
                          key={period}
                          className={`px-4 py-4 font-mono ${returnTone(
                            row.period_returns[period]
                          )}`}
                        >
                          {formatPercent(row.period_returns[period])}
                        </td>
                      ))}
                      <td className="px-4 py-4 font-mono text-zinc-300">
                        {formatNumber(row.supply)}
                      </td>
                      <td className="px-4 py-4 text-zinc-400">
                        {formatTimestamp(row.updated_at)}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/gmtrade/${row.type.toLowerCase()}/${row.mint}`}
                          aria-label={`Open ${row.name} price chart`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 transition-colors hover:bg-emerald-400/20"
                          title="Open price chart"
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
