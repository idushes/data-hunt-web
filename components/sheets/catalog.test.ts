import { describe, expect, it } from "vitest";

import { sheetSources } from "./catalog";


const publishedSources = {
  fluid: ["/fluid/positions.csv", "position_id"],
  aave: ["/aave/positions.csv", "position_id"],
  morpho: ["/morpho/positions.csv", "position_id"],
  compound: ["/compound/positions.csv", "position_id"],
  euler: ["/euler/positions.csv", "position_id"],
  lido: ["/lido/positions.csv", "position_id"],
  gmx: ["/gmx/positions.csv", "position_id"],
  uniswap: ["/uniswap/positions.csv", "position_id"],
  stablecoins: ["/stablecoins/balances.csv", "balance_id"],
  stakedao: ["/stakedao/positions.csv", "position_id"],
  "cmc-price": ["/cmc/price.csv", null],
  hyperliquid: ["/hyperliquid/balance", "account"],
  lighter: ["/lighter/balance", "account_index"],
  paradex: ["/paradex/balance", "account"],
  coinbase: ["/coinbase/balance", "id"],
  "gmtrade-assets": ["/solana/gmtrade.csv", "mint"],
  "jupiter-jlp": ["/jupiter/jlp.csv", "position_id"],
  "gmtrade-perps": ["/solana/gmtrade-perps.csv", "position_address"],
  "kamino-vaults": ["/solana/kamino.csv", "vault_address"],
  "kamino-positions": ["/solana/kamino-positions.csv", "vault_address"],
} as const;


describe("Sheets source catalog contract", () => {
  it("does not remove or rename published sources, paths, or stable keys", () => {
    const actual = Object.fromEntries(
      sheetSources.map((source) => [
        source.id,
        [source.path, source.keyColumn ?? null],
      ])
    );

    expect(actual).toEqual(publishedSources);
  });

  it("has unique source IDs and parameter names", () => {
    const sourceIds = sheetSources.map((source) => source.id);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);

    for (const source of sheetSources) {
      const parameterNames = source.parameters.map((parameter) => parameter.key);
      expect(
        new Set(parameterNames).size,
        `${source.id} contains duplicate parameters`
      ).toBe(parameterNames.length);
    }
  });

  it("keeps every requiredAny field represented in the source parameters", () => {
    for (const source of sheetSources) {
      const parameterNames = new Set(
        source.parameters.map((parameter) => parameter.key)
      );
      for (const required of source.requiredAny ?? []) {
        expect(parameterNames.has(required), `${source.id}.${required}`).toBe(true);
      }
    }
  });

  it("keeps the published stablecoin networks and wallet types available", () => {
    const stablecoins = sheetSources.find(
      (source) => source.id === "stablecoins"
    );
    expect(stablecoins).toBeDefined();
    expect(stablecoins?.requiredAny).toEqual([
      "address",
      "wallet",
      "tron_address",
    ]);

    const network = stablecoins?.parameters.find(
      (parameter) => parameter.key === "chain_id"
    );
    expect(network?.options?.map((option) => option.value)).toEqual([
      "1",
      "42161",
      "8453",
    ]);
  });

  it("requires an encrypted browser-held access key for Coinbase", () => {
    const coinbase = sheetSources.find((source) => source.id === "coinbase");
    const capsule = coinbase?.parameters.find(
      (parameter) => parameter.key === "capsule"
    );

    expect(capsule).toMatchObject({ kind: "secret", required: true });
    expect(
      coinbase?.parameters.some((parameter) =>
        ["token", "key_name", "key_secret"].includes(parameter.key)
      )
    ).toBe(false);
  });
});
