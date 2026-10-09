import { describe, expect, it } from "vitest";
import { apyToApr, capacity, csvExport, family, matches, number, type BorrowMarket, type Filters } from "./model";

const row: BorrowMarket = { id: "1", protocol: "Aave", chain: "Ethereum", name: "standard", collateral: "WETH", collateralAddress: "0x01", debt: "USDC", debtAddress: "0x02", apr: 5, ltv: 80, liquidationThreshold: 85, liquidityUsd: 100_000, collateralPrice: 2500, debtPrice: 1, collateralCapacityUsd: null, minimumDebtUsd: null, quotedDebtUsd: null, borrowFee: null, url: "https://app.aave.com", notes: [] };
const filters: Filters = { chain: [], protocol: [], collateral: [], debt: [], maxApr: null, minLtv: null, minLoanUsd: 0, availableOnly: true };
describe("borrow comparisons", () => {
  it("uses opening LTV, buffer, liquidity, collateral caps and minimum debt", () => {
    expect(capacity(row, 10_000, 10)).toBe(7200);
    expect(capacity({ ...row, liquidityUsd: 2000 }, 10_000, 10)).toBe(2000);
    expect(capacity({ ...row, collateralCapacityUsd: 9999 }, 10_000, 10)).toBe(0);
    expect(capacity({ ...row, minimumDebtUsd: 10_000 }, 10_000, 10)).toBe(0);
    expect(capacity({ ...row, quotedDebtUsd: 6000 }, 10_000, 10)).toBe(5400);
  });
  it("does not turn missing values or liquidation threshold into loan capacity", () => {
    expect(capacity({ ...row, ltv: null }, 10_000, 10)).toBeNull();
    expect(capacity({ ...row, liquidityUsd: null }, 10_000, 10)).toBeNull();
    expect(capacity(row, Infinity, 10)).toBeNull();
    expect(capacity(row, 10_000, 100)).toBeNull();
    expect(number(null)).toBeNull(); expect(number(true)).toBeNull(); expect(number("NaN")).toBeNull();
    expect(number("0")).toBe(0);
  });
  it("compares nominal APR rather than a mixture of APR and APY", () => {
    expect(apyToApr(0.1)).toBeCloseTo(9.531018, 5);
    expect(apyToApr(0)).toBe(0);
    expect(apyToApr(null)).toBeNull();
  });
  it("keeps exact tokens separate and filters missing APR", () => {
    expect(family("cbBTC")).toBe("BTC"); expect(family("wstETH")).toBe("ETH"); expect(family("USDC")).toBeNull();
    expect(matches(row, { ...filters, collateral: ["ETH"] }, 10_000, 10)).toBe(true);
    expect(matches(row, { ...filters, collateral: ["token:ETH"] }, 10_000, 10)).toBe(false);
    expect(matches(row, { ...filters, chain: ["Base"] }, 10_000, 10)).toBe(false);
    expect(matches(row, { ...filters, minLoanUsd: 8000 }, 10_000, 10)).toBe(false);
    expect(matches({ ...row, apr: null }, { ...filters, maxApr: 10 }, 10_000, 10)).toBe(false);
    expect(matches({ ...row, liquidityUsd: 0 }, filters, 10_000, 10)).toBe(false);
    expect(matches({ ...row, liquidityUsd: 0 }, { ...filters, availableOnly: false }, 10_000, 10)).toBe(true);
  });
  it("combines selections within each filter and intersects different filters", () => {
    const selected: Filters = { ...filters, chain: ["Ethereum", "Base"], protocol: ["Aave", "Morpho"], collateral: ["token:WETH", "token:cbBTC"], debt: ["USDC", "USDT"] };
    expect(matches(row, selected, 10_000, 10)).toBe(true);
    expect(matches({ ...row, chain: "Base", protocol: "Morpho", collateral: "cbBTC", debt: "USDT" }, selected, 10_000, 10)).toBe(true);
    for (const changed of [{ chain: "Arbitrum" as const }, { protocol: "Fluid" }, { collateral: "wstETH" }, { debt: "DAI" }]) {
      expect(matches({ ...row, ...changed }, selected, 10_000, 10)).toBe(false);
    }
    expect(matches({ ...row, apr: 15 }, { ...selected, maxApr: 10 }, 10_000, 10)).toBe(false);
    expect(matches(row, { ...selected, minLtv: 90 }, 10_000, 10)).toBe(false);
    expect(matches({ ...row, liquidityUsd: 0 }, selected, 10_000, 10)).toBe(false);
    expect(matches(row, { ...selected, minLoanUsd: 8000 }, 10_000, 10)).toBe(false);
  });
  it("allows mixed token families and exact tokens, with empty selections including all", () => {
    const selected: Filters = { ...filters, collateral: ["BTC", "token:WETH"] };
    expect(matches(row, selected, 10_000, 10)).toBe(true);
    expect(matches({ ...row, collateral: "cbBTC" }, selected, 10_000, 10)).toBe(true);
    expect(matches({ ...row, collateral: "wstETH" }, selected, 10_000, 10)).toBe(false);
    expect(matches({ ...row, collateral: "wstETH" }, { ...filters, collateral: ["ETH", "BTC"] }, 10_000, 10)).toBe(true);
    expect(matches({ ...row, chain: "Solana", protocol: "Jupiter Lend", collateral: "xBTC", debt: "JupUSD" }, filters, 10_000, 10)).toBe(true);
  });
  it("exports calculation inputs, addresses, fees and guarded spreadsheet cells", () => {
    const csv = csvExport([{ ...row, name: '=HYPERLINK("evil")' }], 10_000, 10);
    expect(csv).toContain('"borrow_usd"'); expect(csv).toContain('"7200"'); expect(csv).toContain('"360"');
    expect(csv).toContain("'=HYPERLINK"); expect(csv).toContain('"collateral_address"');
  });
});
