import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { landingSources } from "./sources";
import { sheetSources } from "../sheets/catalog";

describe("landing sources", () => {
  it("represents every Sheets source exactly once", () => {
    const representedIds = landingSources.flatMap((source) => source.sourceIds);
    expect(representedIds.toSorted()).toEqual(
      sheetSources.map((source) => source.id).toSorted(),
    );
    expect(new Set(representedIds).size).toBe(representedIds.length);
  });

  it("combines project tables into compact Kamino and GMTrade cards", () => {
    const kamino = landingSources.find((source) => source.name === "Kamino");
    const gmtrade = landingSources.find((source) => source.name === "GMTrade");

    expect(kamino?.sourceIds).toEqual(["kamino-vaults", "kamino-positions"]);
    expect(kamino?.detail).toBe("kVaults · Positions");
    expect(gmtrade?.sourceIds).toEqual(["gmtrade-assets", "gmtrade-perps"]);
    expect(gmtrade?.detail).toBe("Assets · Perpetuals");
  });

  it("gives every source one or more local logo assets", () => {
    for (const source of landingSources) {
      expect(source.logos.length).toBeGreaterThan(0);

      for (const logo of source.logos) {
        expect(logo).toMatch(/^\//);
        expect(existsSync(resolve(process.cwd(), "public", logo.slice(1)))).toBe(
          true
        );
      }
    }
  });
});
