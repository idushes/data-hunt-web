"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/landing/Header";
import {
  isRaydiumCacheFresh,
  RAYDIUM_CACHE_REFRESH_MS,
  raydiumPoolCacheKey,
  readRaydiumCache,
  writeRaydiumCache,
} from "@/app/raydium/cache";
import { raydiumPoolUrl } from "@/app/raydium/links";
import type {
  RaydiumApiError,
  RaydiumDistributionPoint,
  RaydiumLiquidityPoint,
  RaydiumPeriodMetrics,
  RaydiumPoolDetailResponse,
} from "@/app/raydium/types";

const CHART_WIDTH = 960;
const CHART_HEIGHT = 300;
const CHART_MARGIN = { top: 24, right: 24, bottom: 44, left: 62 };

function formatUsd(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value);
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1 ? 4 : 8,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

function formatFeeRate(value: number) {
  return formatPercent(value * 100);
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

function formatDateFromUnix(value: number | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value * 1000));
}

function shortAddress(value: string) {
  return value.length > 16 ? `${value.slice(0, 6)}...${value.slice(-6)}` : value;
}

function metricRange(metrics: RaydiumPeriodMetrics) {
  if (metrics.priceMin === null || metrics.priceMax === null) return "-";
  return `${formatNumber(metrics.priceMin)} – ${formatNumber(metrics.priceMax)}`;
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="m15 18-6-6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalIcon() {
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

function LiquidityHistoryChart({ points }: { points: RaydiumLiquidityPoint[] }) {
  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((point) => point.liquidity);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(max - min, max * 0.02, 1);
    const low = Math.max(0, min - spread * 0.12);
    const high = max + spread * 0.12;
    const innerWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
    const innerHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
    const x = (index: number) =>
      CHART_MARGIN.left + (index / (points.length - 1)) * innerWidth;
    const y = (value: number) =>
      CHART_MARGIN.top + ((high - value) / (high - low)) * innerHeight;
    const line = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.liquidity)}`)
      .join(" ");
    const baseline = CHART_MARGIN.top + innerHeight;
    const area = `${line} L${x(points.length - 1)},${baseline} L${x(0)},${baseline} Z`;

    return { line, area, low, high, baseline };
  }, [points]);

  if (!chart) {
    return <p className="py-20 text-center text-sm text-zinc-600">TVL history is not available for this pool.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="min-w-[720px]" role="img" aria-label="30 day pool TVL history">
        <defs>
          <linearGradient id="raydium-tvl-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = CHART_MARGIN.top + ratio * (chart.baseline - CHART_MARGIN.top);
          const value = chart.high - ratio * (chart.high - chart.low);
          return (
            <g key={ratio}>
              <line x1={CHART_MARGIN.left} x2={CHART_WIDTH - CHART_MARGIN.right} y1={y} y2={y} stroke="rgba(255,255,255,.08)" />
              <text x={CHART_MARGIN.left - 10} y={y + 4} textAnchor="end" fill="#71717a" fontSize="11">{formatUsd(value)}</text>
            </g>
          );
        })}
        <path d={chart.area} fill="url(#raydium-tvl-fill)" />
        <path d={chart.line} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinejoin="round" />
        <text x={CHART_MARGIN.left} y={CHART_HEIGHT - 14} fill="#71717a" fontSize="11">
          {new Date(points[0].timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </text>
        <text x={CHART_WIDTH - CHART_MARGIN.right} y={CHART_HEIGHT - 14} textAnchor="end" fill="#71717a" fontSize="11">
          {new Date(points.at(-1)!.timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </text>
      </svg>
    </div>
  );
}

function LiquidityDistributionChart({
  points,
  currentPrice,
}: {
  points: RaydiumDistributionPoint[];
  currentPrice: number;
}) {
  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const minPrice = Math.min(...points.map((point) => point.price));
    const maxPrice = Math.max(...points.map((point) => point.price));
    const maxLiquidity = Math.max(...points.map((point) => point.liquidity));
    const logMin = Math.log(minPrice);
    const logMax = Math.log(maxPrice);
    const innerWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
    const innerHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
    const x = (price: number) =>
      CHART_MARGIN.left + ((Math.log(price) - logMin) / (logMax - logMin)) * innerWidth;
    const y = (liquidity: number) =>
      CHART_MARGIN.top +
      (1 - Math.log10(liquidity + 1) / Math.log10(maxLiquidity + 1)) * innerHeight;
    const baseline = CHART_MARGIN.top + innerHeight;
    const line = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.price)},${y(point.liquidity)}`)
      .join(" ");
    const area = `${line} L${x(points.at(-1)!.price)},${baseline} L${x(points[0].price)},${baseline} Z`;
    const currentX =
      currentPrice >= minPrice && currentPrice <= maxPrice ? x(currentPrice) : null;
    return { line, area, baseline, currentX, minPrice, maxPrice };
  }, [currentPrice, points]);

  if (!chart) {
    return <p className="py-20 text-center text-sm text-zinc-600">Liquidity distribution is not available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="min-w-[720px]" role="img" aria-label="CLMM liquidity distribution by price">
        <defs>
          <linearGradient id="raydium-depth-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = CHART_MARGIN.top + ratio * (chart.baseline - CHART_MARGIN.top);
          return <line key={ratio} x1={CHART_MARGIN.left} x2={CHART_WIDTH - CHART_MARGIN.right} y1={y} y2={y} stroke="rgba(255,255,255,.08)" />;
        })}
        <path d={chart.area} fill="url(#raydium-depth-fill)" />
        <path d={chart.line} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />
        {chart.currentX !== null && (
          <g>
            <line x1={chart.currentX} x2={chart.currentX} y1={CHART_MARGIN.top} y2={chart.baseline} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="5 5" />
            <text x={chart.currentX} y={CHART_MARGIN.top - 7} textAnchor="middle" fill="#fcd34d" fontSize="11">Current {formatNumber(currentPrice)}</text>
          </g>
        )}
        <text x={CHART_MARGIN.left} y={CHART_HEIGHT - 14} fill="#71717a" fontSize="11">{formatNumber(chart.minPrice)}</text>
        <text x={CHART_WIDTH - CHART_MARGIN.right} y={CHART_HEIGHT - 14} textAnchor="end" fill="#71717a" fontSize="11">{formatNumber(chart.maxPrice)}</text>
      </svg>
    </div>
  );
}

export default function RaydiumPoolPage() {
  const params = useParams<{ poolId: string }>();
  const poolId = params.poolId ?? "";
  const [data, setData] = useState<RaydiumPoolDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cacheNotice, setCacheNotice] = useState("");
  const [cachedAt, setCachedAt] = useState("");

  const loadData = useCallback(async () => {
    if (!poolId) return;
    setLoading(true);
    setError("");
    setCacheNotice("");

    try {
      const response = await fetch(`/api/raydium?id=${encodeURIComponent(poolId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as RaydiumPoolDetailResponse | RaydiumApiError;
      if (!response.ok || !("pool" in payload)) {
        throw new Error("error" in payload ? payload.error : "Failed to load the Raydium pool.");
      }
      setData(payload);
      const cached = writeRaydiumCache(raydiumPoolCacheKey(poolId), payload);
      setCachedAt(cached?.cachedAt ?? payload.fetchedAt);
    } catch (caught) {
      const cached = readRaydiumCache<RaydiumPoolDetailResponse>(raydiumPoolCacheKey(poolId));
      if (cached) {
        setData(cached.payload);
        setCachedAt(cached.cachedAt);
        setCacheNotice("Raydium is temporarily unavailable. Showing the latest cached pool data.");
      } else {
        setError(caught instanceof Error ? caught.message : "Failed to load the Raydium pool.");
      }
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  useEffect(() => {
    if (!poolId) return;
    const cached = readRaydiumCache<RaydiumPoolDetailResponse>(raydiumPoolCacheKey(poolId));
    if (cached) {
      setData(cached.payload);
      setCachedAt(cached.cachedAt);
    }
    if (!cached || !isRaydiumCacheFresh(cached)) void loadData();

    const interval = window.setInterval(loadData, RAYDIUM_CACHE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadData, poolId]);

  const pool = data?.pool;
  const periods = pool
    ? ([
        ["24 hours", pool.day],
        ["7 days", pool.week],
        ["30 days", pool.month],
      ] as const)
    : [];

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-24 md:px-6">
        <section className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link href="/raydium" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white">
              <BackIcon /> Raydium pools
            </Link>
            <div className="mt-4 flex min-w-0 items-center gap-3">
              <span className={`rounded border px-2 py-1 text-xs font-semibold ${pool?.type === "Concentrated" ? "border-violet-400/30 bg-violet-400/10 text-violet-200" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"}`}>
                {pool?.type === "Concentrated" ? "CLMM" : pool?.type ?? "Pool"}
              </span>
              <h1 className="truncate text-3xl font-bold text-white md:text-4xl">
                {pool ? `${pool.mintA.symbol}/${pool.mintB.symbol}` : shortAddress(poolId)}
              </h1>
            </div>
            <p className="mt-2 truncate font-mono text-xs text-zinc-600">{poolId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pool && (
              <a href={raydiumPoolUrl(pool.type, pool.id)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-violet-300 px-5 text-sm font-semibold text-black transition-colors hover:bg-violet-200">
                Add liquidity <ExternalIcon />
              </a>
            )}
            <button type="button" onClick={() => void loadData()} disabled={loading} className="min-h-11 rounded-lg border border-zinc-800 bg-zinc-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50">
              {loading ? "Loading" : "Refresh"}
            </button>
          </div>
        </section>

        {cacheNotice && <section className="mt-6 rounded-lg border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{cacheNotice}</section>}
        {error && <section className="mt-8 rounded-lg border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">{error}</section>}
        {loading && !data && <section className="mt-10 flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" /></section>}

        {pool && data && (
          <>
            <div className="mt-4 text-right text-xs text-zinc-600">{cacheNotice ? "Cached" : "Updated"} {formatTimestamp(cachedAt || data.fetchedAt)}{loading ? " · refreshing" : ""}</div>
            <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-5"><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Price</p><p className="mt-2 text-2xl font-semibold text-white">{formatNumber(pool.price)}</p><p className="mt-1 text-xs text-zinc-600">{pool.mintB.symbol} per {pool.mintA.symbol}</p></div>
              <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-5"><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">TVL</p><p className="mt-2 text-2xl font-semibold text-white">{formatUsd(pool.tvl)}</p></div>
              <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-5"><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Fee tier</p><p className="mt-2 text-2xl font-semibold text-white">{formatFeeRate(pool.feeRate)}</p><p className="mt-1 text-xs text-zinc-600">{pool.hasDynamicFee ? "Dynamic fee enabled" : "Fixed fee"}</p></div>
              <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-5"><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">30D APR</p><p className="mt-2 text-2xl font-semibold text-emerald-300">{formatPercent(pool.month.apr)}</p><p className="mt-1 text-xs text-zinc-600">Indicative pool APR</p></div>
            </section>

            <section className="mt-8 overflow-hidden rounded-lg border border-white/10">
              <div className="border-b border-white/10 p-5"><h2 className="text-lg font-semibold text-white">Pool performance</h2><p className="mt-1 text-sm text-zinc-500">Fees, volume, and indicative APR reported by Raydium.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-zinc-950 text-xs uppercase tracking-[0.12em] text-zinc-500"><tr><th className="px-5 py-3">Period</th><th className="px-5 py-3">Volume</th><th className="px-5 py-3">Fees</th><th className="px-5 py-3">Fee APR</th><th className="px-5 py-3">Reward APR</th><th className="px-5 py-3">Total APR</th><th className="px-5 py-3">Price range</th></tr></thead>
                  <tbody className="divide-y divide-white/10">
                    {periods.map(([label, metrics]) => <tr key={label}><td className="px-5 py-4 font-medium text-white">{label}</td><td className="px-5 py-4 font-mono text-zinc-300">{formatUsd(metrics.volume)}</td><td className="px-5 py-4 font-mono text-zinc-300">{formatUsd(metrics.volumeFee)}</td><td className="px-5 py-4 font-mono text-zinc-300">{formatPercent(metrics.feeApr)}</td><td className="px-5 py-4 font-mono text-zinc-300">{formatPercent(metrics.rewardApr)}</td><td className="px-5 py-4 font-mono text-emerald-300">{formatPercent(metrics.apr)}</td><td className="px-5 py-4 font-mono text-zinc-400">{metricRange(metrics)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 rounded-lg border border-white/10 bg-zinc-950/40">
              <div className="border-b border-white/10 p-5"><h2 className="text-lg font-semibold text-white">TVL · last 30 days</h2><p className="mt-1 text-sm text-zinc-500">Daily pool liquidity reported by Raydium.</p></div>
              <div className="p-3 md:p-5"><LiquidityHistoryChart points={data.liquidityHistory} /></div>
            </section>

            {pool.type === "Concentrated" && (
              <section className="mt-8 rounded-lg border border-white/10 bg-zinc-950/40">
                <div className="border-b border-white/10 p-5"><h2 className="text-lg font-semibold text-white">Liquidity distribution</h2><p className="mt-1 text-sm text-zinc-500">Active CLMM liquidity across nearby price ticks. The horizontal scale is logarithmic.</p></div>
                <div className="p-3 md:p-5"><LiquidityDistributionChart points={data.liquidityDistribution} currentPrice={pool.price} /></div>
              </section>
            )}

            <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-white/10 p-5"><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Pool opened</p><p className="mt-2 font-medium text-white">{formatDateFromUnix(pool.openTime)}</p></div>
              <div className="rounded-lg border border-white/10 p-5"><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{pool.mintA.symbol} reserves</p><p className="mt-2 font-mono text-white">{formatNumber(pool.mintAmountA)}</p></div>
              <div className="rounded-lg border border-white/10 p-5"><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{pool.mintB.symbol} reserves</p><p className="mt-2 font-mono text-white">{formatNumber(pool.mintAmountB)}</p></div>
              <div className="rounded-lg border border-white/10 p-5"><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Rewards</p><p className="mt-2 font-medium text-white">{pool.rewardSymbols.length > 0 ? pool.rewardSymbols.join(", ") : "None"}</p></div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
