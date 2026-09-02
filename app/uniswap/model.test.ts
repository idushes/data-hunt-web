import { describe, expect, it } from "vitest";
import { matchesPair, normalizeYieldPool, poolAnalyticsUrl, readSavedPairs, savedPairKey, validateSearch } from "./model";

const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const raw = {
  pool: "b99bcdf5-1350-4269-981e-0e9b5cccb007", project: "uniswap-v3", chain: "Base",
  symbol: "WETH-USDC", underlyingTokens: [WETH, USDC], poolMeta: "0.05%",
  tvlUsd: 1_000_000, apyBase: 12, apyReward: null, apy: 12, apyMean30d: 10,
  apyPct7D: 900, apyBase7d: 800, volumeUsd1d: 500_000,
};
const pool = normalizeYieldPool(raw)!;
const search = validateSearch({ tokenA: "eth", tokenB: "usdc" });

describe("Uniswap provider normalization", () => {
  it("keeps only the reported metrics with explicit units", () => {
    expect(pool).toMatchObject({ version: "V3", feeTier: "0.05%", tvl: 1_000_000, feeApy: 12, totalApy: 12, rewardApy: null, average30d: 10, volume24h: 500_000 });
    expect(pool).not.toHaveProperty("apyPct7D");
    expect(pool).not.toHaveProperty("apyBase7d");
  });
  it("preserves zero without inventing missing yields", () => {
    expect(normalizeYieldPool({ ...raw, apyBase: 0, apy: null, apyMean30d: undefined, volumeUsd1d: NaN })).toMatchObject({ feeApy: 0, totalApy: null, average30d: null, volume24h: null });
    expect(normalizeYieldPool({ ...raw, apyBase: -1, apyReward: false, apyMean30d: "Infinity" })).toMatchObject({ feeApy: null, rewardApy: null, average30d: null });
  });
  it("does not present missing dynamic-fee calculations as zero returns", () => {
    expect(normalizeYieldPool({ ...raw, project: "uniswap-v4", poolMeta: "Dynamic fee (hook)", apyBase: 0, apy: 0 })).toMatchObject({ dynamicFee: true, feeApy: null, totalApy: null, average30d: null });
  });
  it.each([
    { project: "uniswap-v3-fork" }, { project: "toString" }, { pool: "../unsafe" },
    { underlyingTokens: [WETH, "invalid"] }, { underlyingTokens: [WETH, USDC, "bad"] },
    { tvlUsd: -1 }, { tvlUsd: null }, { chain: "" }, { symbol: null },
  ])("rejects invalid or unrelated rows: %j", overrides => {
    expect(normalizeYieldPool({ ...raw, ...overrides })).toBeNull();
  });
  it("recognizes V2 and V4 and marks provider outliers", () => {
    expect(normalizeYieldPool({ ...raw, project: "uniswap-v2", poolMeta: null })).toMatchObject({ version: "V2", feeTier: "0.3%" });
    expect(normalizeYieldPool({ ...raw, project: "uniswap-v4", outlier: true })).toMatchObject({ version: "V4", outlier: true });
  });
});

describe("Uniswap exact pair search", () => {
  it("is case and order insensitive, and supports ETH/WETH", () => {
    expect(matchesPair(pool, search)).toBe(true);
    expect(matchesPair(pool, { ...search, tokenA: "USDC", tokenB: "WETH" })).toBe(true);
    expect(matchesPair(pool, { ...search, tokenA: "USDC", tokenB: "ETH" })).toBe(true);
  });
  it("supports addresses or a mix of address and symbol", () => {
    expect(matchesPair(pool, { ...search, tokenA: USDC.toUpperCase(), tokenB: WETH })).toBe(true);
    expect(matchesPair(pool, { ...search, tokenA: WETH, tokenB: "USDC" })).toBe(true);
  });
  it("does not match substrings, bridged tokens, or the same side twice", () => {
    expect(matchesPair(pool, { ...search, tokenB: "USD" })).toBe(false);
    expect(matchesPair({ ...pool, symbol: "WETH-USDC.e" }, search)).toBe(false);
    expect(matchesPair(pool, { ...search, tokenB: "ETH" })).toBe(false);
    expect(matchesPair(pool, { ...search, tokenA: "WSTETH" })).toBe(false);
  });
  it("filters networks and versions", () => {
    expect(matchesPair(pool, { ...search, chain: "base", version: "V3" })).toBe(true);
    expect(matchesPair(pool, { ...search, chain: "Ethereum" })).toBe(false);
    expect(matchesPair(pool, { ...search, version: "V4" })).toBe(false);
  });
  it("requires addresses for ambiguous hyphenated symbols", () => {
    expect(matchesPair({ ...pool, symbol: "WETH-USDC-X" }, search)).toBe(false);
    expect(matchesPair({ ...pool, symbol: "WETH-USDC-X" }, { ...search, tokenA: WETH, tokenB: USDC })).toBe(true);
  });
  it.each([
    {}, { tokenA: "ETH", tokenB: "" }, { tokenA: "ETH/USDC", tokenB: "ETH" },
    { tokenA: "x".repeat(65), tokenB: "ETH" }, { tokenA: "0x123", tokenB: "ETH" },
    { ...search, chain: "../Base" }, { ...search, version: "V5" }, { ...search, version: ["V3"] },
  ])("rejects invalid input: %j", value => expect(() => validateSearch(value)).toThrow());
  it("normalizes input", () => {
    expect(validateSearch({ tokenA: " eth ", tokenB: USDC.toUpperCase(), chain: " Base ", version: "V3" })).toEqual({ tokenA: "ETH", tokenB: USDC, chain: "Base", version: "V3" });
  });
});

describe("saved pairs and analytics links", () => {
  it("deduplicates reversed pairs and ignores corrupt stored entries", () => {
    const reverse = { ...search, tokenA: "USDC", tokenB: "ETH" };
    expect(savedPairKey(search)).toBe(savedPairKey(reverse));
    expect(readSavedPairs([null, {}, search, reverse])).toEqual([reverse]);
    expect(readSavedPairs("invalid")).toEqual([]);
  });
  it("keeps networks separate and limits storage to twenty pairs", () => {
    expect(readSavedPairs([search, { ...search, chain: "Base" }])).toHaveLength(2);
    expect(readSavedPairs(Array.from({ length: 25 }, (_, i) => ({ ...search, tokenA: `TOKEN${i}` })))).toHaveLength(20);
  });
  it("links to the actual provider pool UUID, not a fabricated onchain address", () => {
    expect(poolAnalyticsUrl(pool.id)).toBe(`https://defillama.com/yields/pool/${raw.pool}`);
    expect(poolAnalyticsUrl("x?redirect=evil")).toBe("https://defillama.com/yields/pool/x%3Fredirect%3Devil");
  });
});
