import { describe, expect, it, vi } from "vitest";
import { fetchBorrowCatalog, normalizeAaveV3, normalizeAaveV4, normalizeFluid, normalizeMorpho } from "./source";

const col = { symbol: "WETH", address: "0x01", price: { usd: 2500 } };
const debt = { symbol: "USDC", address: "0x02", price: { usd: 1 } };
const rawMorpho = { marketId: `0x${"ab".repeat(32)}`, collateralAsset: col, loanAsset: debt, lltv: "860000000000000000", state: { borrowApy: .05, liquidityAssetsUsd: 100_000 } };
const token = { symbol: "WBTC", address: "0x01", price: "80000", decimals: 8 };
const stable = { symbol: "USDC", address: "0x02", price: "0.99", decimals: 6 };
const zero = { address: `0x${"0".repeat(40)}` };
const fluid = { id: "10", supplyToken: { token0: token, token1: zero }, borrowToken: { token0: stable, token1: zero }, collateralFactor: 8000, liquidationThreshold: 8500, borrowable: "1000000000", minimumBorrowing: "1000000", borrowRate: { vault: { rate: "650" } } };
describe("borrow source normalization", () => {
  it("uses Morpho LLTV WAD and avoids deprecated priceUsd", () => {
    expect(normalizeMorpho(rawMorpho, "Base")).toMatchObject({ ltv: 86, liquidationThreshold: 86, collateralPrice: 2500, debtPrice: 1 });
    expect(normalizeMorpho({ ...rawMorpho, loanAsset: { ...debt, symbol: "WETH" } }, "Base")).toBeNull();
    expect(normalizeMorpho({ ...rawMorpho, marketId: "bad" }, "Base")).toBeNull();
  });
  it("converts Fluid bps and raw available debt without including smart pairs", () => {
    expect(normalizeFluid(fluid, "Ethereum")).toMatchObject({ apr: 6.5, ltv: 80, liquidationThreshold: 85, liquidityUsd: 990, minimumDebtUsd: .99 });
    expect(normalizeFluid({ ...fluid, supplyToken: { token0: token, token1: stable } }, "Ethereum")).toBeNull();
    expect(normalizeFluid({ ...fluid, borrowable: null }, "Ethereum")?.liquidityUsd).toBeNull();
  });
  it("uses Jupiter's different risk scale and base rate units", () => {
    expect(normalizeFluid({ ...fluid, supplyToken: token, borrowToken: stable, collateralFactor: "800", liquidationThreshold: "850", borrowRate: "650", borrowFee: "25" }, "Solana", true)).toMatchObject({ protocol: "Jupiter Lend", apr: 6.5, ltv: 80, liquidationThreshold: 85, borrowFee: .25 });
  });
  it("pairs Aave V3 debt with collateral in the same pool and caps borrowing", () => {
    const c = { underlyingToken: col, usdExchangeRate: "2500", isFrozen: false, isPaused: false, supplyInfo: { canBeCollateral: true, supplyCapReached: false, maxLTV: { value: ".8" }, liquidationThreshold: { value: ".85" }, supplyCap: { usd: "100000" }, total: { value: "20" } } };
    const d = { underlyingToken: debt, usdExchangeRate: "1", isFrozen: false, isPaused: false, borrowInfo: { apy: { value: ".05" }, borrowingState: "ENABLED", borrowCapReached: false, borrowCap: { usd: "10000" }, total: { usd: "9000" }, availableLiquidity: { usd: "5000" } } };
    const data = { markets: [{ name: "main", address: "0x03", reserves: [c, d] }, { name: "other", address: "0x04", reserves: [c] }] };
    expect(normalizeAaveV3(data, "Ethereum", 10_000)).toHaveLength(1);
    expect(normalizeAaveV3(data, "Ethereum", 10_000)[0]).toMatchObject({ ltv: 80, liquidationThreshold: 85, liquidityUsd: 1000, collateralCapacityUsd: 50000 });
    expect(normalizeAaveV3({ markets: [{ ...data.markets[0], reserves: [{ ...c, isFrozen: true }, d] }] }, "Ethereum", 10_000)).toEqual([]);
    expect(normalizeAaveV3({ markets: [{ ...data.markets[0], reserves: [{ ...c, isIsolatedCollateral: true }, d] }] }, "Ethereum", 10_000)).toEqual([]);
  });
  it("uses Aave V4 percentage units and a single-collateral risk premium", () => {
    const common = { status: { active: true, paused: false, frozen: false }, spoke: { id: "same", name: "main" } };
    const c = { ...common, id: "c", canSupply: true, canUseAsCollateral: true, settings: { collateralFactor: { normalized: "80" }, collateralRisk: { normalized: "50" } }, summary: { suppliable: { exchange: { value: "100000" } } }, asset: { underlying: { address: col.address, info: col } } };
    const d = { ...common, id: "d", canBorrow: true, summary: { borrowable: { exchange: { value: "30000" } } }, asset: { underlying: { address: debt.address, info: debt }, summary: { borrowApy: { normalized: "5" } } } };
    const rows = normalizeAaveV4({ reserves: [c, d] }, "Arc");
    expect(rows).toHaveLength(1); expect(rows[0].ltv).toBe(80); expect(rows[0].apr).toBeCloseTo(7.3185246, 5);
    expect(normalizeAaveV4({ reserves: [c, { ...d, spoke: { id: "other" } }] }, "Arc")).toEqual([]);
  });
  it("keeps partial source failures visible and rejects a complete outage", async () => {
    const fail = vi.fn<typeof fetch>().mockRejectedValue(new Error("private provider detail"));
    await expect(fetchBorrowCatalog("Solana", 10_000, 10, fail)).rejects.toThrow("Borrow data unavailable");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (String(url).includes("api.fluid.io")) return new Response(JSON.stringify([fluid]));
      throw new Error("outage");
    });
    const data = await fetchBorrowCatalog("Base", 10_000, 10, fetcher);
    expect(data.markets).toHaveLength(1); expect(data.coverage.find(c => c.source === "Morpho")?.status).toBe("error");
    expect(JSON.stringify(data)).not.toContain("outage");
  });
});
