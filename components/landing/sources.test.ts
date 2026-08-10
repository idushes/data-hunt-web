import { describe, expect, it } from "vitest";

import { landingSources } from "./sources";
import { sheetSources } from "../sheets/catalog";

describe("landing sources", () => {
  it("shows every source available in the Sheets helper", () => {
    expect(landingSources.map((source) => source.id)).toEqual(
      sheetSources.map((source) => source.id)
    );
  });

  it("gives every source a visual mark", () => {
    for (const source of landingSources) {
      expect(source.mark).not.toBe("");
      expect(source.tone).toMatch(/^from-/);
    }
  });
});
