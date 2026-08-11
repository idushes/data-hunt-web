import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { landingSources } from "./sources";
import { sheetSources } from "../sheets/catalog";

describe("landing sources", () => {
  it("shows every source available in the Sheets helper", () => {
    expect(landingSources.map((source) => source.id)).toEqual(
      sheetSources.map((source) => source.id)
    );
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
