import type {
  RaydiumDistributionPoint,
  RaydiumLiquidityPoint,
  RaydiumPeriodMetrics,
  RaydiumPool,
  RaydiumToken,
} from "@/app/raydium/types";

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = numberValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeToken(value: unknown): RaydiumToken {
  const token = asRecord(value);
  const address = stringValue(token.address);

  return {
    address,
    symbol: stringValue(token.symbol) || address,
    name: stringValue(token.name) || stringValue(token.symbol) || address,
    decimals: Math.max(0, Math.trunc(numberValue(token.decimals))),
  };
}

function normalizeMetrics(value: unknown): RaydiumPeriodMetrics {
  const metrics = asRecord(value);
  const rewardApr = asList(metrics.rewardApr).reduce<number>(
    (sum, item) => sum + numberValue(item),
    0
  );

  return {
    volume: numberValue(metrics.volume),
    volumeFee: numberValue(metrics.volumeFee),
    apr: numberValue(metrics.apr),
    feeApr: numberValue(metrics.feeApr),
    rewardApr,
    priceMin: nullableNumber(metrics.priceMin),
    priceMax: nullableNumber(metrics.priceMax),
  };
}

export function normalizeRaydiumPool(value: unknown): RaydiumPool | null {
  const pool = asRecord(value);
  const id = stringValue(pool.id);
  const type = stringValue(pool.type);

  if (!id || (type !== "Concentrated" && type !== "Standard")) return null;

  const rewardEntries = asList(pool.rewardDefaultInfos)
    .map((item) => {
      const reward = asRecord(item);
      return {
        mint: normalizeToken(reward.mint),
        startTime: numberValue(reward.startTime),
        endTime: numberValue(reward.endTime),
      };
    })
    .filter((reward) => reward.mint.address);
  const now = Date.now() / 1000;
  const activeRewards = rewardEntries.filter(
    (reward) =>
      reward.startTime > 0 &&
      reward.endTime > 0 &&
      reward.startTime <= now &&
      reward.endTime >= now
  );
  const day = normalizeMetrics(pool.day);
  const week = normalizeMetrics(pool.week);
  const month = normalizeMetrics(pool.month);
  const rewardMints =
    activeRewards.length > 0 || day.rewardApr <= 0
      ? activeRewards.map((reward) => reward.mint)
      : rewardEntries.map((reward) => reward.mint);
  const config = asRecord(pool.config);

  return {
    id,
    type,
    programId: stringValue(pool.programId),
    mintA: normalizeToken(pool.mintA ?? pool.mint1),
    mintB: normalizeToken(pool.mintB ?? pool.mint2),
    price: numberValue(pool.price),
    tvl: numberValue(pool.tvl),
    feeRate: numberValue(pool.feeRate),
    mintAmountA: numberValue(pool.mintAmountA),
    mintAmountB: numberValue(pool.mintAmountB),
    openTime:
      pool.openTime === null || pool.openTime === undefined
        ? null
        : numberValue(pool.openTime),
    day,
    week,
    month,
    rewardSymbols: Array.from(
      new Set(rewardMints.map((mint) => mint.symbol).filter(Boolean))
    ),
    hasRewards: activeRewards.length > 0 || day.rewardApr > 0,
    tickSpacing:
      config.tickSpacing === null || config.tickSpacing === undefined
        ? null
        : numberValue(config.tickSpacing),
    hasDynamicFee: pool.hasDynamicFee === true,
  };
}

export function normalizeLiquidityHistory(
  value: unknown
): RaydiumLiquidityPoint[] {
  const payload = asRecord(value);

  return asList(payload.line)
    .map((item) => {
      const point = asRecord(item);
      return {
        timestamp: numberValue(point.time),
        liquidity: numberValue(point.liquidity),
      };
    })
    .filter((point) => point.timestamp > 0 && point.liquidity >= 0)
    .sort((left, right) => left.timestamp - right.timestamp);
}

function downsampleDistribution(
  points: RaydiumDistributionPoint[],
  maxPoints: number
) {
  if (points.length <= maxPoints) return points;

  const sampled: RaydiumDistributionPoint[] = [];
  const bucketSize = points.length / maxPoints;

  for (let index = 0; index < maxPoints; index += 1) {
    const start = Math.floor(index * bucketSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
    const bucket = points.slice(start, end);
    const strongest = bucket.reduce((best, point) =>
      point.liquidity > best.liquidity ? point : best
    );
    sampled.push(strongest);
  }

  return sampled.sort((left, right) => left.price - right.price);
}

export function normalizeLiquidityDistribution(
  value: unknown,
  currentPrice: number,
  maxPoints = 240
): RaydiumDistributionPoint[] {
  const payload = asRecord(value);
  const points = asList(payload.line)
    .map((item) => {
      const point = asRecord(item);
      return {
        price: numberValue(point.price),
        liquidity: numberValue(point.liquidity),
        tick: Math.trunc(numberValue(point.tick)),
      };
    })
    .filter((point) => point.price > 0 && point.liquidity > 0)
    .sort((left, right) => left.price - right.price);

  if (points.length === 0) return [];

  const visible =
    currentPrice > 0
      ? points.filter(
          (point) =>
            point.price >= currentPrice / 20 && point.price <= currentPrice * 20
        )
      : points;

  return downsampleDistribution(visible.length > 0 ? visible : points, maxPoints);
}
