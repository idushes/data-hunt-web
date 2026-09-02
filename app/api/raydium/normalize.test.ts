import { describe, expect, it } from "vitest";
import {
  normalizeLiquidityDistribution,
  normalizeLiquidityHistory,
  normalizeRaydiumPool,
} from "./normalize";

describe("Raydium response normalization", () => {
  it("normalizes pool metrics and reward APR", () => {
    const pool = normalizeRaydiumPool({
      id: "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv",
      type: "Concentrated",
      programId: "program",
      mintA: { address: "mint-a", symbol: "SOL", name: "Solana", decimals: 9 },
      mintB: { address: "mint-b", symbol: "USDC", name: "USD Coin", decimals: 6 },
      price: 100,
      tvl: 1_000_000,
      feeRate: 0.0004,
      day: { volume: 500_000, apr: 12, feeApr: 10, rewardApr: [1, 1] },
      week: {},
      month: {},
      rewardDefaultInfos: [{ mint: { address: "ray", symbol: "RAY" } }],
      config: { tickSpacing: 1 },
    });

    expect(pool).toMatchObject({
      type: "Concentrated",
      price: 100,
      tvl: 1_000_000,
      rewardSymbols: ["RAY"],
      hasRewards: true,
      tickSpacing: 1,
      day: { volume: 500_000, apr: 12, feeApr: 10, rewardApr: 2 },
    });
  });

  it("rejects unsupported pool records", () => {
    expect(normalizeRaydiumPool({ id: "pool", type: "Unknown" })).toBeNull();
    expect(normalizeRaydiumPool({ type: "Standard" })).toBeNull();
  });

  it("sorts TVL history and bounds CLMM distribution output", () => {
    expect(
      normalizeLiquidityHistory({
        line: [
          { time: 2, liquidity: 20 },
          { time: 1, liquidity: 10 },
        ],
      })
    ).toEqual([
      { timestamp: 1, liquidity: 10 },
      { timestamp: 2, liquidity: 20 },
    ]);

    const distribution = normalizeLiquidityDistribution(
      {
        line: Array.from({ length: 100 }, (_, index) => ({
          price: index + 1,
          liquidity: index + 10,
          tick: index,
        })),
      },
      50,
      10
    );

    expect(distribution).toHaveLength(10);
    expect(distribution.every((point) => point.price >= 2.5)).toBe(true);
    expect(distribution.map((point) => point.price)).toEqual(
      [...distribution.map((point) => point.price)].sort((a, b) => a - b)
    );
  });
});
