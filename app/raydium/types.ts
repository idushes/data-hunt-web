export type RaydiumPoolType = "Concentrated" | "Standard";

export type RaydiumToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
};

export type RaydiumPeriodMetrics = {
  volume: number;
  volumeFee: number;
  apr: number;
  feeApr: number;
  rewardApr: number;
  priceMin: number | null;
  priceMax: number | null;
};

export type RaydiumPool = {
  id: string;
  type: RaydiumPoolType;
  programId: string;
  mintA: RaydiumToken;
  mintB: RaydiumToken;
  price: number;
  tvl: number;
  feeRate: number;
  mintAmountA: number;
  mintAmountB: number;
  openTime: number | null;
  day: RaydiumPeriodMetrics;
  week: RaydiumPeriodMetrics;
  month: RaydiumPeriodMetrics;
  rewardSymbols: string[];
  hasRewards: boolean;
  tickSpacing: number | null;
  hasDynamicFee: boolean;
};

export type RaydiumPoolsResponse = {
  mode: "pools";
  rows: RaydiumPool[];
  nextPageId: string | null;
  fetchedAt: string;
  summary: {
    poolCount: number;
    concentratedCount: number;
    standardCount: number;
    totalTvl: number;
    volume24h: number;
  };
};

export type RaydiumLiquidityPoint = {
  timestamp: number;
  liquidity: number;
};

export type RaydiumDistributionPoint = {
  price: number;
  liquidity: number;
  tick: number;
};

export type RaydiumPoolDetailResponse = {
  mode: "pool-detail";
  pool: RaydiumPool;
  liquidityHistory: RaydiumLiquidityPoint[];
  liquidityDistribution: RaydiumDistributionPoint[];
  fetchedAt: string;
};

export type RaydiumApiError = {
  error: string;
};
