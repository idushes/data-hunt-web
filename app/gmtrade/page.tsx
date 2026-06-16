"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/landing/Header";

type PoolType = "GM" | "GLV";
type PeriodKey = "1d" | "7d" | "30d" | "90d" | "1y";
type PoolTypeFilter = "ALL" | PoolType;
type SortKey =
  | "favorite"
  | "pool"
  | "position_value"
  | "position_apy"
  | "supply"
  | PeriodKey;
type SortDirection = "asc" | "desc";
type SortState = {
  key: SortKey;
  direction: SortDirection;
};
type SupplyFilter = {
  min: string;
};

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

type PositionRow = {
  type: PoolType;
  mint: string;
  name: string;
  balance: number;
  price_usd: number;
  value_usd: number;
  entry_timestamp: string;
  entry_price_usd: number | null;
  cost_basis_usd: number | null;
  pnl_usd: number | null;
  return_percent: number | null;
  annualized_return_percent: number | null;
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

type PositionsResponse = {
  wallet: string;
  rows: PositionRow[];
  summary: {
    total_value_usd: number;
    cost_basis_usd: number;
    pnl_usd: number;
    weighted_annualized_return_percent: number | null;
    position_count: number;
    updated_at: string;
  };
};

type ApiError = {
  error: string;
};

const PERIODS: PeriodKey[] = ["1d", "7d", "30d", "90d", "1y"];
const TABLE_PERIODS: PeriodKey[] = ["7d", "30d", "90d", "1y"];
const FAVORITES_STORAGE_KEY = "gmtrade:favorites:v1";
const SUPPLY_FILTER_STORAGE_KEY = "gmtrade:supply-filter:v1";
const POSITION_WALLET_STORAGE_KEY = "gmtrade:position-wallet:v1";
const GMTRADE_APP_URL = "https://gmtrade.xyz";
const EMPTY_SUPPLY_FILTER: SupplyFilter = {
  min: "",
};

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

function formatSupplyUsd(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}%`;
}

function formatSignedUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  if (value === 0) return formatUsd(value);
  return value > 0 ? `+${formatUsd(value)}` : formatUsd(value);
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

function gmTradePoolUrl(row: PoolRow) {
  return `${GMTRADE_APP_URL}/pools/poolDetail/${row.type}/${encodeURIComponent(
    row.mint
  )}`;
}

function defaultSortDirection(key: SortKey): SortDirection {
  return key === "pool" ? "asc" : "desc";
}

function isPeriodSortKey(key: SortKey): key is PeriodKey {
  return PERIODS.includes(key as PeriodKey);
}

function sortValue(
  row: PoolRow,
  key: SortKey,
  favorites: Set<string>,
  positions: Map<string, PositionRow>
) {
  const position = positions.get(favoriteKeyForRow(row));

  if (key === "favorite") return favorites.has(favoriteKeyForRow(row)) ? 1 : 0;
  if (key === "pool") return row.name.toLowerCase();
  if (key === "position_value") return position?.value_usd ?? null;
  if (key === "position_apy") {
    return position?.annualized_return_percent ?? null;
  }
  if (key === "supply") return row.supply;
  if (isPeriodSortKey(key)) return row.period_returns[key];
  return "";
}

function compareSortValues(
  left: string | number | null,
  right: string | number | null,
  direction: SortDirection
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  if (typeof left === "string" && typeof right === "string") {
    return direction === "asc"
      ? left.localeCompare(right)
      : right.localeCompare(left);
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return direction === "asc" ? leftNumber - rightNumber : rightNumber - leftNumber;
}

function parseSupplyFilterValue(value: string) {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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

function storedSupplyFilter(): SupplyFilter {
  try {
    const raw = localStorage.getItem(SUPPLY_FILTER_STORAGE_KEY);
    if (!raw) return EMPTY_SUPPLY_FILTER;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY_SUPPLY_FILTER;

    return {
      min: typeof parsed.min === "string" ? parsed.min : "",
    };
  } catch {
    return EMPTY_SUPPLY_FILTER;
  }
}

function persistSupplyFilter(filter: SupplyFilter) {
  try {
    localStorage.setItem(SUPPLY_FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function storedPositionWallet() {
  try {
    return localStorage.getItem(POSITION_WALLET_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistPositionWallet(wallet: string) {
  try {
    if (wallet) {
      localStorage.setItem(POSITION_WALLET_STORAGE_KEY, wallet);
    } else {
      localStorage.removeItem(POSITION_WALLET_STORAGE_KEY);
    }
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

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3.5 w-3.5 transition-colors ${
        active ? "text-emerald-300" : "text-zinc-700"
      }`}
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth={1.7}
    >
      {active && direction === "asc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 9.5 8 5.5l4 4" />
      ) : active ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="m4 6.5 4 4 4-4" />
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 6.5 8 3.5l3 3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 9.5 3 3 3-3" />
        </>
      )}
    </svg>
  );
}

export default function GMTradePage() {
  const [data, setData] = useState<PoolsResponse | null>(null);
  const [positions, setPositions] = useState<PositionsResponse | null>(null);
  const [error, setError] = useState("");
  const [positionError, setPositionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [positionLoading, setPositionLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [positionWallet, setPositionWallet] = useState("");
  const [typeFilter, setTypeFilter] = useState<PoolTypeFilter>("ALL");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [supplyFilter, setSupplyFilter] =
    useState<SupplyFilter>(EMPTY_SUPPLY_FILTER);
  const [supplyFilterLoaded, setSupplyFilterLoaded] = useState(false);

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

  const loadPositions = useCallback(async (wallet: string) => {
    const normalizedWallet = wallet.trim();

    if (!normalizedWallet) {
      setPositions(null);
      setPositionWallet("");
      setPositionError("");
      persistPositionWallet("");
      return;
    }

    setPositionLoading(true);
    setPositionError("");

    try {
      const response = await fetch(
        `/api/gmtrade?wallet=${encodeURIComponent(normalizedWallet)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as PositionsResponse | ApiError;

      if (!response.ok) {
        const message =
          "error" in payload && payload.error
            ? payload.error
            : "Failed to load wallet positions.";
        throw new Error(message);
      }

      setPositions(payload as PositionsResponse);
      setPositionWallet(normalizedWallet);
      setWalletInput(normalizedWallet);
      setSortState((current) =>
        current ?? { key: "position_value", direction: "desc" }
      );
      persistPositionWallet(normalizedWallet);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to load wallet positions.";
      setPositionError(message);
      setPositions(null);
      setPositionWallet("");
    } finally {
      setPositionLoading(false);
    }
  }, []);

  const refreshData = useCallback(() => {
    void loadPools();
    if (positionWallet) {
      void loadPositions(positionWallet);
    }
  }, [loadPools, loadPositions, positionWallet]);

  useEffect(() => {
    void loadPools();
  }, [loadPools]);

  useEffect(() => {
    setFavorites(storedFavorites());
  }, []);

  useEffect(() => {
    setSupplyFilter(storedSupplyFilter());
    setSupplyFilterLoaded(true);
  }, []);

  useEffect(() => {
    const walletFromUrl =
      new URLSearchParams(window.location.search).get("wallet")?.trim() ?? "";
    const wallet = walletFromUrl || storedPositionWallet();

    if (!wallet) return;

    setWalletInput(wallet);
    void loadPositions(wallet);
  }, [loadPositions]);

  useEffect(() => {
    if (!supplyFilterLoaded) return;
    persistSupplyFilter(supplyFilter);
  }, [supplyFilter, supplyFilterLoaded]);

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

  const updateSupplyFilter = useCallback(
    (field: keyof SupplyFilter, value: string) => {
      setSupplyFilter((current) => ({ ...current, [field]: value }));
    },
    []
  );

  const favoritePoolCount = useMemo(() => {
    if (!data) return favorites.size;

    return data.rows.filter((row) => favorites.has(favoriteKeyForRow(row))).length;
  }, [data, favorites]);

  const positionMap = useMemo(() => {
    const map = new Map<string, PositionRow>();

    for (const position of positions?.rows ?? []) {
      map.set(favoriteKey(position.type, position.mint), position);
    }

    return map;
  }, [positions]);

  const filteredRows = useMemo(() => {
    if (!data) return [];

    const normalizedQuery = query.trim().toLowerCase();
    const minSupply = parseSupplyFilterValue(supplyFilter.min);

    return data.rows.filter((row) => {
      const matchesType = typeFilter === "ALL" || row.type === typeFilter;
      const matchesFavorite =
        !favoritesOnly || favorites.has(favoriteKeyForRow(row));
      const matchesQuery =
        !normalizedQuery ||
        row.name.toLowerCase().includes(normalizedQuery) ||
        row.mint.toLowerCase().includes(normalizedQuery);
      const matchesMinSupply = minSupply === null || row.supply >= minSupply;

      return (
        matchesType &&
        matchesFavorite &&
        matchesQuery &&
        matchesMinSupply
      );
    });
  }, [data, favorites, favoritesOnly, query, supplyFilter, typeFilter]);

  const sortedRows = useMemo(() => {
    if (!sortState) return filteredRows;

    return filteredRows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const comparison = compareSortValues(
          sortValue(left.row, sortState.key, favorites, positionMap),
          sortValue(right.row, sortState.key, favorites, positionMap),
          sortState.direction
        );

        return comparison || left.index - right.index;
      })
      .map(({ row }) => row);
  }, [favorites, filteredRows, positionMap, sortState]);

  const requestSort = useCallback((key: SortKey) => {
    setSortState((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return { key, direction: defaultSortDirection(key) };
    });
  }, []);

  const sortDirectionFor = useCallback(
    (key: SortKey) => (sortState?.key === key ? sortState.direction : undefined),
    [sortState]
  );

  const sortableHeader = useCallback(
    (key: SortKey, label: string, className = "px-4 py-3 font-medium") => {
      const direction = sortDirectionFor(key);

      return (
        <th
          key={key}
          className={className}
          aria-sort={
            direction === "asc"
              ? "ascending"
              : direction === "desc"
              ? "descending"
              : "none"
          }
        >
          <button
            type="button"
            onClick={() => requestSort(key)}
            className="inline-flex items-center gap-1.5 rounded-md text-left transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
          >
            <span>{label}</span>
            <SortIcon active={Boolean(direction)} direction={direction ?? "desc"} />
          </button>
        </th>
      );
    },
    [requestSort, sortDirectionFor]
  );

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

          <div className="flex w-full flex-col gap-3 lg:max-w-5xl lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
            <label className="sr-only" htmlFor="gmtrade-search">
              Search pools
            </label>
            <input
              id="gmtrade-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by pool or mint"
              className="min-h-11 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500 lg:min-w-[240px]"
              autoComplete="off"
              spellCheck={false}
            />
            <form
              className="flex flex-col gap-2 sm:flex-row lg:w-[430px]"
              onSubmit={(event) => {
                event.preventDefault();
                void loadPositions(walletInput);
              }}
            >
              <label className="sr-only" htmlFor="gmtrade-position-wallet">
                Solana wallet for positions
              </label>
              <input
                id="gmtrade-position-wallet"
                value={walletInput}
                onChange={(event) => setWalletInput(event.target.value)}
                placeholder="Solana wallet positions"
                className="min-h-11 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:font-sans placeholder:text-zinc-600 focus:border-emerald-500"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={positionLoading}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {positionLoading ? "Loading" : "Load wallet"}
              </button>
            </form>
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
            <div className="lg:w-[150px]">
              <label className="sr-only" htmlFor="gmtrade-supply-min">
                Minimum supply
              </label>
              <input
                id="gmtrade-supply-min"
                type="number"
                min="0"
                step="any"
                value={supplyFilter.min}
                onChange={(event) => updateSupplyFilter("min", event.target.value)}
                placeholder="Supply min"
                className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500"
                autoComplete="off"
              />
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
              onClick={refreshData}
              disabled={loading || positionLoading}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading || positionLoading ? "Loading" : "Refresh"}
            </button>
          </div>
        </section>

        {data && (
          <section className="mt-8 flex flex-col gap-2 border-b border-white/10 pb-5 text-sm text-zinc-400 md:flex-row md:items-center md:justify-between">
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
              {positions && (
                <>
                  {" "}
                  · <span className="text-zinc-200">
                    {positions.summary.position_count}
                  </span>{" "}
                  positions ·{" "}
                  <span className="text-zinc-200">
                    {formatUsd(positions.summary.total_value_usd)}
                  </span>{" "}
                  in {shortAddress(positionWallet)}
                </>
              )}
              {positionLoading && (
                <>
                  {" "}
                  · <span className="text-zinc-200">loading positions</span>
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

        {positionError && (
          <section className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            Wallet positions: {positionError}
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
                    {sortableHeader(
                      "favorite",
                      "Fav",
                      "w-12 px-4 py-3 font-medium"
                    )}
                    {sortableHeader("pool", "Pool")}
                    {sortableHeader("position_value", "Position")}
                    {sortableHeader("position_apy", "Yearly APY")}
                    {TABLE_PERIODS.map((period) =>
                      sortableHeader(period, period.toUpperCase())
                    )}
                    {sortableHeader("supply", "Supply")}
                    <th className="px-4 py-3 font-medium">Chart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-black">
                  {sortedRows.map((row) => {
                    const position = positionMap.get(favoriteKeyForRow(row));

                    return (
                      <tr
                        key={`${row.type}-${row.mint}`}
                        className={`hover:bg-zinc-950 ${
                          position ? "bg-emerald-950/10" : ""
                        }`}
                      >
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
                            <StarIcon
                              filled={favorites.has(favoriteKeyForRow(row))}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <a
                            href={gmTradePoolUrl(row)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${row.name} on GMTrade`}
                            className="group/pool flex min-w-0 items-center gap-3 rounded-md outline-none transition-colors hover:text-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                            title="Open pool on GMTrade"
                          >
                            <span
                              className={`rounded border px-2 py-1 text-xs font-semibold ${poolTypeTone(
                                row.type
                              )}`}
                            >
                              {row.type}
                            </span>
                            <div className="min-w-0">
                              <p className="max-w-[320px] truncate font-medium text-white transition-colors group-hover/pool:text-emerald-100">
                                {row.name}
                              </p>
                              <p className="font-mono text-xs text-zinc-500 transition-colors group-hover/pool:text-zinc-300">
                                {shortAddress(row.mint)}
                              </p>
                            </div>
                          </a>
                        </td>
                        <td className="px-4 py-4 font-mono">
                          {position ? (
                            <span className="font-semibold text-emerald-200">
                              {formatUsd(position.value_usd)}
                            </span>
                          ) : (
                            <span className="text-zinc-700">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 font-mono">
                          {position ? (
                            <div>
                              <p
                                className={returnTone(
                                  position.annualized_return_percent
                                )}
                              >
                                {formatPercent(
                                  position.annualized_return_percent
                                )}
                              </p>
                              <p
                                className={`mt-1 text-xs ${returnTone(
                                  position.pnl_usd
                                )}`}
                              >
                                {formatSignedUsd(position.pnl_usd)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-zinc-700">-</span>
                          )}
                        </td>
                        {TABLE_PERIODS.map((period) => (
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
                          {formatSupplyUsd(row.supply)}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
