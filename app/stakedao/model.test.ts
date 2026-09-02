import { describe, expect, it } from "vitest";
import { matchesStrategy, normalizeStrategy, normalizeWallet, parsePositions, positionStrategy, positionTotals, savedWalletChoices, strategyUrl } from "./model";

const wallet = `0x${"1".repeat(40)}`;
const vault = `0x${"2".repeat(40)}`;
const asset = `0x${"3".repeat(40)}`;
const gauge = `0x${"4".repeat(40)}`;
const raw = { name: "frxUSD/USG", chainId: 1, vault, lpToken: { address: asset }, sdGauge: { address: gauge }, coins: [{ symbol: "frxUSD", address: asset }], tvl: 1_000_000, apr: { boost: 1.99, current: { total: 29.46 }, projected: { total: 40 } }, onlyboost: { active: true } };
const strategy = normalizeStrategy(raw, "curve", 2)!;
const csv = `wallet,chain_id,position_id,position_contract,asset_address,name,amount,value_usd,protocol,product,position_type,asset_symbol,apr_current_percent,apr_projected_percent,claimable_reward_symbol,claimable_reward_amount,claimable_reward_value_usd\n${wallet},1,position-1,${vault},${asset},"frxUSD/USG, vault",43044,42981,curve,strategy,vault_v2,LP,,88,CRV,100,23.07\n`;

describe("Stake DAO strategy catalogue", () => {
  it("reads current APR and OnlyBoost without replacing current with projected APR", () => {
    expect(strategy).toMatchObject({ version: 2, name: "frxUSD/USG", apr: 29.46, projectedApr: 40, boost: 1.99, onlyBoost: true, chain: "Ethereum" });
    expect(normalizeStrategy({ ...raw, apr: { projected: { total: 99 } } }, "curve", 2)?.apr).toBeNull();
  });
  it("preserves zero and unknown fields separately", () => {
    expect(normalizeStrategy({ ...raw, apr: { current: { total: 0 } }, tvl: null }, "curve", 1)).toMatchObject({ apr: 0, tvl: null, boost: null });
    expect(normalizeStrategy({ ...raw, apr: { current: { total: Infinity } } }, "curve", 1)?.apr).toBeNull();
  });
  it.each([{ vault: "javascript:bad" }, { chainId: 0 }, { chainId: 1.2 }, { name: null }, { lpToken: {} }])("rejects invalid strategy rows: %j", values => {
    expect(normalizeStrategy({ ...raw, ...values }, "curve", 2)).toBeNull();
  });
  it("matches pair in either order and exact contracts", () => {
    expect(matchesStrategy(strategy, "USG / frxUSD")).toBe(true);
    expect(matchesStrategy(strategy, "frxUSD,sUSDe")).toBe(false);
    expect(matchesStrategy(strategy, vault.toUpperCase())).toBe(true);
    expect(matchesStrategy(strategy, `0x${"a".repeat(40)}`)).toBe(false);
  });
  it("constructs a fixed-origin official strategy link", () => {
    expect(strategyUrl(strategy)).toBe(`https://app.stakedao.org/strategy?protocol=curve&vault=1-${vault}`);
  });
});

describe("Stake DAO wallet positions", () => {
  it("parses quoted CSV and does not substitute projected pool APR for current strategy APR", () => {
    const [position] = parsePositions(csv, wallet);
    expect(position).toMatchObject({ name: "frxUSD/USG, vault", amount: 43044, valueUsd: 42981, apr: null, rewardUsd: 23.07 });
    expect(positionStrategy(position, [strategy])?.apr).toBe(29.46);
  });
  it("matches enrichment by chain, vault/gauge and underlying asset, never by symbol", () => {
    const [position] = parsePositions(csv, wallet);
    expect(positionStrategy({ ...position, contract: gauge }, [strategy])).toBe(strategy);
    expect(positionStrategy({ ...position, chainId: 10 }, [strategy])).toBeUndefined();
    expect(positionStrategy({ ...position, contract: wallet }, [strategy])).toBeUndefined();
    expect(positionStrategy({ ...position, assetAddress: wallet }, [strategy])).toBeUndefined();
  });
  it("accepts header-only empty results and removes repeated position rows", () => {
    expect(parsePositions(csv.split("\n")[0], wallet)).toEqual([]);
    expect(parsePositions(csv + csv.split("\n")[1], wallet)).toHaveLength(1);
  });
  it("rejects unrelated wallets, networks, and malformed tables", () => {
    expect(() => parsePositions("error,detail\ninvalid,no", wallet)).toThrow("invalid table");
    expect(() => parsePositions(csv, vault)).toThrow("unexpected wallet");
    expect(() => parsePositions(csv.replace(",1,position-1", ",10,position-1"), wallet)).toThrow("network");
  });
  it("returns partial totals with explicit missing coverage", () => {
    const [position] = parsePositions(csv, wallet);
    expect(positionTotals([position, { ...position, valueUsd: null, rewardUsd: null }])).toEqual({ valueUsd: 42981, rewardUsd: 23.07, unpriced: 1, missingRewards: 1 });
    expect(positionTotals([{ ...position, valueUsd: null, rewardUsd: null }])).toMatchObject({ valueUsd: null, rewardUsd: null });
    expect(positionTotals([])).toEqual({ valueUsd: 0, rewardUsd: 0, unpriced: 0, missingRewards: 0 });
  });
  it("normalizes addresses and validates saved browser choices", () => {
    expect(normalizeWallet(` ${wallet.toUpperCase()} `)).toBe(wallet);
    expect(() => normalizeWallet("0x123")).toThrow("valid EVM");
    expect(savedWalletChoices([null, { kind: "evm", value: wallet, label: "Main" }, { kind: "solana", value: wallet }, { kind: "evm", value: "invalid" }])).toEqual([{ label: "Main", address: wallet }]);
    expect(savedWalletChoices({})).toEqual([]);
  });
});
