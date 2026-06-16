"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Header from "@/components/landing/Header";

type PoolType = "GM" | "GLV";
type PeriodKey = "1d" | "7d" | "30d" | "90d" | "1y";
type ChartRangeKey = "7d" | "30d" | "90d" | "1y" | "all" | "custom";
type ChartScaleMode = "price" | "change";

type PricePoint = {
  timestamp: string;
  price_usd: number;
};

type PoolDetail = {
  mode: "pool-detail";
  type: PoolType;
  mint: string;
  name: string;
  price_usd: number;
  supply: number;
  liquidity_usd: number;
  period_returns: Record<PeriodKey, number | null>;
  long_token_mint: string;
  short_token_mint: string;
  index_token_mint: string;
  updated_at: string;
  history: PricePoint[];
};

type PositionRow = {
  type: PoolType;
  mint: string;
  entry_timestamp: string;
  entry_price_usd: number | null;
};

type PositionsResponse = {
  rows: PositionRow[];
};

type EntryMarker = {
  timestamp: string;
  price_usd: number;
};

type ApiError = {
  error: string;
};

const PERIODS: PeriodKey[] = ["1d", "7d", "30d", "90d", "1y"];
const CHART_RANGES: { key: Exclude<ChartRangeKey, "custom">; label: string; days: number | null }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "All", days: null },
];
const CHART_SCALE_MODES: { key: ChartScaleMode; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "change", label: "Change %" },
];
const DAY_MS = 24 * 60 * 60 * 1000;
const GMTRADE_APP_URL = "https://gmtrade.xyz";
const POSITION_WALLET_STORAGE_KEY = "gmtrade:position-wallet:v1";

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
    maximumFractionDigits: 0,
  })}%`;
}

function formatTimestamp(value: string) {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function formatDate(value: string | number) {
  const parsed = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) return String(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  }).format(new Date(parsed));
}

function formatDateWithYear(value: string | number) {
  const parsed = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) return String(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(parsed));
}

function dateInputValue(value: number) {
  if (!Number.isFinite(value)) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputStart(value: string) {
  const parsed = Date.parse(`${value}T00:00:00`);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateInputEnd(value: string) {
  const parsed = Date.parse(`${value}T23:59:59`);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentChange(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null;
  return ((end - start) / start) * 100;
}

function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}%`;
}

function formatChartAxisValue(value: number, mode: ChartScaleMode) {
  if (mode === "change") {
    return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US", {
      maximumFractionDigits: 1,
    })}%`;
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 10 ? 2 : 4,
  });
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

function gmTradePoolUrl(type: string, mint: string) {
  return `${GMTRADE_APP_URL}/pools/poolDetail/${type}/${encodeURIComponent(mint)}`;
}

function storedPositionWallet() {
  try {
    return localStorage.getItem(POSITION_WALLET_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19 3 12m0 0 7-7m-7 7h18" />
    </svg>
  );
}

function PriceChart({
  points,
  entryMarker,
}: {
  points: PricePoint[];
  entryMarker: EntryMarker | null;
}) {
  const [rangeKey, setRangeKey] = useState<ChartRangeKey>("90d");
  const [scaleMode, setScaleMode] = useState<ChartScaleMode>("price");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    const validPoints = points
      .map((point) => ({
        ...point,
        time: Date.parse(point.timestamp),
      }))
      .filter((point) => Number.isFinite(point.time) && point.price_usd > 0)
      .sort((a, b) => a.time - b.time);

    if (validPoints.length < 2) {
      return null;
    }

    const width = 960;
    const height = 420;
    const overviewHeight = 72;
    const padding = {
      top: 24,
      right: 28,
      bottom: 52,
      left: 74,
    };
    const allTimes = validPoints.map((point) => point.time);
    const availableStart = Math.min(...allTimes);
    const availableEnd = Math.max(...allTimes);
    const selectedRange = CHART_RANGES.find((range) => range.key === rangeKey);
    const presetStart =
      selectedRange?.days === null || !selectedRange
        ? availableStart
        : Math.max(availableStart, availableEnd - selectedRange.days * DAY_MS);
    const customStart = customRange.from
      ? dateInputStart(customRange.from) ?? availableStart
      : availableStart;
    const customEnd = customRange.to
      ? dateInputEnd(customRange.to) ?? availableEnd
      : availableEnd;
    const rawStart = rangeKey === "custom" ? customStart : presetStart;
    const rawEnd = rangeKey === "custom" ? customEnd : availableEnd;
    const selectedStart = Math.max(availableStart, Math.min(rawStart, rawEnd));
    const selectedEnd = Math.min(availableEnd, Math.max(rawStart, rawEnd));
    const visiblePoints = validPoints.filter(
      (point) => point.time >= selectedStart && point.time <= selectedEnd
    );
    const selectedPoints =
      visiblePoints.length >= 2
        ? visiblePoints
        : validPoints.slice(Math.max(0, validPoints.length - 2));
    const selectedStartTime = selectedPoints[0].time;
    const selectedEndTime = selectedPoints[selectedPoints.length - 1].time;
    const startPrice = selectedPoints[0].price_usd;
    const endPrice = selectedPoints[selectedPoints.length - 1].price_usd;
    const displayValues = selectedPoints.map((point) =>
      scaleMode === "change"
        ? percentChange(startPrice, point.price_usd) ?? 0
        : point.price_usd
    );
    const entryTime = entryMarker ? Date.parse(entryMarker.timestamp) : Number.NaN;
    const entryDisplayValue =
      entryMarker &&
      entryMarker.price_usd > 0 &&
      Number.isFinite(entryTime) &&
      entryTime >= selectedStartTime &&
      entryTime <= selectedEndTime
        ? scaleMode === "change"
          ? percentChange(startPrice, entryMarker.price_usd)
          : entryMarker.price_usd
        : null;
    const domainValues =
      entryDisplayValue === null || !Number.isFinite(entryDisplayValue)
        ? displayValues
        : [...displayValues, entryDisplayValue];
    const minValue = Math.min(...domainValues);
    const maxValue = Math.max(...domainValues);
    const valueRange = maxValue - minValue || Math.max(Math.abs(maxValue), 1) * 0.02;
    const valuePadding = valueRange * 0.08;
    const yMin =
      scaleMode === "price" ? Math.max(0, minValue - valuePadding) : minValue - valuePadding;
    const yMax = maxValue + valuePadding;
    const yRange = yMax - yMin || 1;
    const timeRange = selectedEndTime - selectedStartTime || 1;
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const xForTime = (time: number) =>
      padding.left + ((time - selectedStartTime) / timeRange) * innerWidth;
    const yForValue = (value: number) =>
      padding.top + (1 - (value - yMin) / yRange) * innerHeight;

    const mappedPoints = selectedPoints.map((point, index) => {
      const displayValue = displayValues[index];
      const x = xForTime(point.time);
      const y = yForValue(displayValue);

      return {
        ...point,
        displayValue,
        x,
        y,
        changeFromStart: percentChange(startPrice, point.price_usd),
      };
    });
    const mappedEntryMarker =
      entryMarker &&
      entryDisplayValue !== null &&
      Number.isFinite(entryDisplayValue)
        ? (() => {
            const x = xForTime(entryTime);
            const y = yForValue(entryDisplayValue);
            const labelOnLeft = x > padding.left + innerWidth - 130;
            const labelAnchor: "end" | "start" = labelOnLeft ? "end" : "start";

            return {
              timestamp: entryMarker.timestamp,
              price_usd: entryMarker.price_usd,
              displayValue: entryDisplayValue,
              x,
              y,
              labelX: labelOnLeft ? x - 10 : x + 10,
              labelY: Math.max(
                padding.top + 14,
                Math.min(y - 12, height - padding.bottom - 8)
              ),
              labelAnchor,
            };
          })()
        : null;

    const path = mappedPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
    const areaPath = `${path} L ${mappedPoints.at(-1)?.x.toFixed(2)} ${
      height - padding.bottom
    } L ${mappedPoints[0].x.toFixed(2)} ${height - padding.bottom} Z`;
    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const value = yMax - ratio * yRange;
      const y = padding.top + ratio * innerHeight;
      return { value, y };
    });
    const tickCount = Math.min(6, selectedPoints.length);
    const xTicks = Array.from({ length: tickCount }, (_, index) => {
      const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
      const time = selectedStartTime + ratio * timeRange;
      const x = padding.left + ratio * innerWidth;
      return { time, x };
    });
    const allMinPrice = Math.min(...validPoints.map((point) => point.price_usd));
    const allMaxPrice = Math.max(...validPoints.map((point) => point.price_usd));
    const overviewRange = allMaxPrice - allMinPrice || 1;
    const overviewTop = 18;
    const overviewBottom = overviewHeight - 18;
    const overviewInnerHeight = overviewBottom - overviewTop;
    const overviewTimeRange = availableEnd - availableStart || 1;
    const overviewPolyline = validPoints
      .map((point) => {
        const x =
          padding.left +
          ((point.time - availableStart) / overviewTimeRange) * innerWidth;
        const y =
          overviewTop +
          (1 - (point.price_usd - allMinPrice) / overviewRange) * overviewInnerHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
    const overviewSelectionX =
      padding.left +
      ((selectedStartTime - availableStart) / overviewTimeRange) * innerWidth;
    const overviewSelectionWidth = Math.max(
      2,
      ((selectedEndTime - selectedStartTime) / overviewTimeRange) * innerWidth
    );

    return {
      width,
      height,
      overviewHeight,
      padding,
      path,
      areaPath,
      yTicks,
      xTicks,
      mappedPoints,
      overviewPolyline,
      overviewSelectionX,
      overviewSelectionWidth,
      entryMarker: mappedEntryMarker,
      selectedStartTime,
      selectedEndTime,
      availableStart,
      availableEnd,
      rangeStartInput: dateInputValue(selectedStartTime),
      rangeEndInput: dateInputValue(selectedEndTime),
      availableStartInput: dateInputValue(availableStart),
      availableEndInput: dateInputValue(availableEnd),
      startPrice,
      endPrice,
      minPrice: Math.min(...selectedPoints.map((point) => point.price_usd)),
      maxPrice: Math.max(...selectedPoints.map((point) => point.price_usd)),
      totalChange: percentChange(startPrice, endPrice),
      pointCount: selectedPoints.length,
      dayCount: Math.max(1, Math.round((selectedEndTime - selectedStartTime) / DAY_MS)),
    };
  }, [customRange, entryMarker, points, rangeKey, scaleMode]);

  if (!chart) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-white/10 bg-zinc-950 text-sm text-zinc-500">
        Price history is not available.
      </div>
    );
  }

  const selectedPoint =
    chart.mappedPoints[
      activeIndex === null
        ? chart.mappedPoints.length - 1
        : Math.min(activeIndex, chart.mappedPoints.length - 1)
    ];

  function selectRange(key: Exclude<ChartRangeKey, "custom">) {
    setRangeKey(key);
    setCustomRange({ from: "", to: "" });
    setActiveIndex(null);
  }

  function setCustomDate(field: "from" | "to", value: string) {
    setRangeKey("custom");
    setActiveIndex(null);
    const rangeStartInput = chart!.rangeStartInput;
    const rangeEndInput = chart!.rangeEndInput;

    setCustomRange((current) => ({
      from:
        field === "from"
          ? value
          : current.from || rangeStartInput,
      to:
        field === "to"
          ? value
          : current.to || rangeEndInput,
    }));
  }

  function moveActivePoint(delta: number) {
    setActiveIndex((current) => {
      const base = current ?? chart!.mappedPoints.length - 1;
      return Math.max(0, Math.min(chart!.mappedPoints.length - 1, base + delta));
    });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * chart!.width;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    chart!.mappedPoints.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setActiveIndex(nearestIndex);
  }

  function handleChartKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveActivePoint(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveActivePoint(1);
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(chart!.mappedPoints.length - 1);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950 p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            Price history
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-2xl font-semibold text-white">
              {formatPrice(selectedPoint.price_usd)}
            </span>
            <span className={`font-mono text-sm ${returnTone(selectedPoint.changeFromStart)}`}>
              {formatSignedPercent(selectedPoint.changeFromStart)}
            </span>
            <span className="text-sm text-zinc-400">
              {formatDateWithYear(selectedPoint.timestamp)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>
              {formatDateWithYear(chart.selectedStartTime)} -{" "}
              {formatDateWithYear(chart.selectedEndTime)}
            </span>
            <span>{chart.pointCount} points</span>
            <span>{chart.dayCount} days</span>
            <span>
              Range {formatPrice(chart.minPrice)} - {formatPrice(chart.maxPrice)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap gap-2">
            {CHART_RANGES.map((range) => (
              <button
                key={range.key}
                type="button"
                onClick={() => selectRange(range.key)}
                className={`min-h-9 rounded-md border px-3 text-xs font-semibold transition-colors ${
                  rangeKey === range.key
                    ? "border-emerald-400 bg-emerald-400 text-black"
                    : "border-zinc-800 bg-black text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <label className="sr-only" htmlFor="gmtrade-chart-from">
              Chart from date
            </label>
            <input
              id="gmtrade-chart-from"
              type="date"
              min={chart.availableStartInput}
              max={chart.availableEndInput}
              value={rangeKey === "custom" ? customRange.from : chart.rangeStartInput}
              onChange={(event) => setCustomDate("from", event.target.value)}
              onInput={(event) => setCustomDate("from", event.currentTarget.value)}
              className="min-h-9 rounded-md border border-zinc-800 bg-black px-3 text-xs text-zinc-200 outline-none transition-colors focus:border-emerald-400"
            />
            <label className="sr-only" htmlFor="gmtrade-chart-to">
              Chart to date
            </label>
            <input
              id="gmtrade-chart-to"
              type="date"
              min={chart.availableStartInput}
              max={chart.availableEndInput}
              value={rangeKey === "custom" ? customRange.to : chart.rangeEndInput}
              onChange={(event) => setCustomDate("to", event.target.value)}
              onInput={(event) => setCustomDate("to", event.currentTarget.value)}
              className="min-h-9 rounded-md border border-zinc-800 bg-black px-3 text-xs text-zinc-200 outline-none transition-colors focus:border-emerald-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {CHART_SCALE_MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setScaleMode(mode.key)}
                className={`min-h-9 rounded-md border px-3 text-xs font-semibold transition-colors ${
                  scaleMode === mode.key
                    ? "border-cyan-300 bg-cyan-300 text-black"
                    : "border-zinc-800 bg-black text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                {mode.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => moveActivePoint(-1)}
              className="min-h-9 rounded-md border border-zinc-800 bg-black px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-900"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => moveActivePoint(1)}
              className="min-h-9 rounded-md border border-zinc-800 bg-black px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-900"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <svg
        className="mt-5 h-[420px] w-full touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label="Pool price history chart"
        preserveAspectRatio="none"
        tabIndex={0}
        onPointerMove={handlePointerMove}
        onKeyDown={handleChartKeyDown}
      >
        <defs>
          <linearGradient id="gmtrade-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {chart.yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={chart.padding.left}
              x2={chart.width - chart.padding.right}
              y1={tick.y}
              y2={tick.y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
            <text
              x={chart.padding.left - 12}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-zinc-500 text-[11px]"
              vectorEffect="non-scaling-stroke"
            >
              {formatChartAxisValue(tick.value, scaleMode)}
            </text>
          </g>
        ))}
        {chart.xTicks.map((tick) => (
          <g key={tick.x}>
            <line
              x1={tick.x}
              x2={tick.x}
              y1={chart.padding.top}
              y2={chart.height - chart.padding.bottom}
              stroke="rgba(255,255,255,0.045)"
              strokeWidth="1"
            />
            <text
              x={tick.x}
              y={chart.height - 18}
              textAnchor="middle"
              className="fill-zinc-500 text-[12px]"
              vectorEffect="non-scaling-stroke"
            >
              {formatDate(tick.time)}
            </text>
          </g>
        ))}
        <path d={chart.areaPath} fill="url(#gmtrade-chart-fill)" />
        <path
          d={chart.path}
          stroke="#34d399"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.2"
          vectorEffect="non-scaling-stroke"
        />
        {chart.entryMarker && (
          <g>
            <title>
              Entry {formatPrice(chart.entryMarker.price_usd)} on{" "}
              {formatDateWithYear(chart.entryMarker.timestamp)}
            </title>
            <line
              x1={chart.entryMarker.x}
              x2={chart.entryMarker.x}
              y1={chart.padding.top}
              y2={chart.height - chart.padding.bottom}
              stroke="rgba(250,204,21,0.6)"
              strokeDasharray="5 5"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={chart.entryMarker.x}
              cy={chart.entryMarker.y}
              r="6"
              fill="#050505"
              stroke="#facc15"
              strokeWidth="2.6"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={chart.entryMarker.labelX}
              y={chart.entryMarker.labelY}
              textAnchor={chart.entryMarker.labelAnchor}
              className="fill-yellow-200 text-[11px] font-semibold"
              vectorEffect="non-scaling-stroke"
            >
              Entry
            </text>
          </g>
        )}
        <line
          x1={selectedPoint.x}
          x2={selectedPoint.x}
          y1={chart.padding.top}
          y2={chart.height - chart.padding.bottom}
          stroke="rgba(52,211,153,0.35)"
          strokeDasharray="4 5"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={selectedPoint.x}
          cy={selectedPoint.y}
          r="5"
          fill="#020617"
          stroke="#6ee7b7"
          strokeWidth="2.4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <svg
        className="mt-3 h-[72px] w-full"
        viewBox={`0 0 ${chart.width} ${chart.overviewHeight}`}
        role="img"
        aria-label="Pool full history overview"
        preserveAspectRatio="none"
      >
        <rect
          x={chart.padding.left}
          y="0"
          width={chart.width - chart.padding.left - chart.padding.right}
          height={chart.overviewHeight}
          rx="8"
          fill="rgba(255,255,255,0.025)"
        />
        <polyline
          fill="none"
          points={chart.overviewPolyline}
          stroke="rgba(161,161,170,0.5)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={chart.overviewSelectionX}
          y="7"
          width={chart.overviewSelectionWidth}
          height={chart.overviewHeight - 14}
          rx="6"
          fill="rgba(52,211,153,0.12)"
          stroke="rgba(52,211,153,0.65)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export default function GMTradePoolDetailPage() {
  const params = useParams<{ type: string; mint: string }>();
  const type = String(params.type ?? "").toUpperCase();
  const mint = String(params.mint ?? "");
  const [data, setData] = useState<PoolDetail | null>(null);
  const [position, setPosition] = useState<PositionRow | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPool = useCallback(async () => {
    if (type !== "GM" && type !== "GLV") {
      setError("Unknown pool type.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/gmtrade?type=${encodeURIComponent(type)}&mint=${encodeURIComponent(mint)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as PoolDetail | ApiError;

      if (!response.ok) {
        const message =
          "error" in payload && payload.error
            ? payload.error
            : "Failed to load pool chart.";
        throw new Error(message);
      }

      setData(payload as PoolDetail);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to load pool chart.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mint, type]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  const loadPosition = useCallback(async () => {
    if ((type !== "GM" && type !== "GLV") || !mint) {
      setPosition(null);
      return;
    }

    const walletFromUrl =
      new URLSearchParams(window.location.search).get("wallet")?.trim() ?? "";
    const wallet = walletFromUrl || storedPositionWallet();

    if (!wallet) {
      setPosition(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/gmtrade?wallet=${encodeURIComponent(wallet)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as PositionsResponse | ApiError;

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Failed to load wallet positions."
        );
      }

      const currentPosition = (payload as PositionsResponse).rows.find(
        (row) => row.type === type && row.mint === mint
      );

      setPosition(currentPosition ?? null);
    } catch {
      setPosition(null);
    }
  }, [mint, type]);

  useEffect(() => {
    void loadPosition();
  }, [loadPosition]);

  const entryMarker = useMemo<EntryMarker | null>(() => {
    if (!position?.entry_timestamp || position.entry_price_usd === null) return null;

    return {
      timestamp: position.entry_timestamp,
      price_usd: position.entry_price_usd,
    };
  }, [position]);

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-24 md:px-6">
        <section className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/gmtrade"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
            >
              <BackIcon />
              GMTRADE pools
            </Link>
            <a
              href={gmTradePoolUrl(data?.type ?? type, data?.mint ?? mint)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${data?.name ?? shortAddress(mint)} on GMTrade`}
              className="group/pool mt-4 flex min-w-0 items-center gap-3 rounded-md outline-none transition-colors hover:text-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-400/70"
              title="Open pool on GMTrade"
            >
              <span
                className={`rounded border px-2 py-1 text-xs font-semibold ${
                  data ? poolTypeTone(data.type) : "border-zinc-700 text-zinc-400"
                }`}
              >
                {data?.type ?? type}
              </span>
              <h1 className="truncate text-3xl font-bold text-white transition-colors group-hover/pool:text-emerald-100 md:text-4xl">
                {data?.name ?? shortAddress(mint)}
              </h1>
            </a>
            <a
              href={gmTradePoolUrl(data?.type ?? type, data?.mint ?? mint)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block max-w-full truncate font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
              title="Open pool on GMTrade"
            >
              {mint}
            </a>
          </div>

          <button
            type="button"
            onClick={() => void loadPool()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading" : "Refresh"}
          </button>
        </section>

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

        {!loading && data && (
          <>
            <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Price
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {formatPrice(data.price_usd)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Liquidity
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {formatUsd(data.liquidity_usd)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  30D Return
                </p>
                <p
                  className={`mt-3 text-2xl font-semibold ${returnTone(
                    data.period_returns["30d"]
                  )}`}
                >
                  {formatPercent(data.period_returns["30d"])}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Updated
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {formatTimestamp(data.updated_at)}
                </p>
              </div>
            </section>

            <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PERIODS.map((period) => (
                <div
                  key={period}
                  className="rounded-lg border border-white/10 bg-zinc-950/70 p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    {period.toUpperCase()}
                  </p>
                  <p
                    className={`mt-2 font-mono text-lg ${returnTone(
                      data.period_returns[period]
                    )}`}
                  >
                    {formatPercent(data.period_returns[period])}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-8">
              <PriceChart points={data.history} entryMarker={entryMarker} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
