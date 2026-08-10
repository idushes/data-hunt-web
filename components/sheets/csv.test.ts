import { describe, expect, it } from "vitest";

import {
  buildImportFormula,
  buildShortValueUrl,
  buildStableValueUrl,
  buildValueResourceDescriptor,
  escapeFormulaText,
  parseCsv,
} from "./csv";


const rows = [
  ["balance_id", "token_symbol", "balance"],
  [
    "ethereum:1:0x6272ab4f91e0df14acb6a2a311d817381210e339:USDT",
    "USDT",
    "1.692943",
  ],
];


describe("parseCsv", () => {
  it("parses commas, escaped quotes, CRLF, and multiline fields", () => {
    const content =
      'id,name,notes\r\n1,"USD, Coin","line 1\nline 2"\r\n' +
      '2,"He said ""yes""",ok\r\n';

    expect(parseCsv(content)).toEqual([
      ["id", "name", "notes"],
      ["1", "USD, Coin", "line 1\nline 2"],
      ["2", 'He said "yes"', "ok"],
    ]);
  });

  it("does not add an empty row for a trailing newline", () => {
    expect(parseCsv("id,value\none,42\n")).toEqual([
      ["id", "value"],
      ["one", "42"],
    ]);
  });
});


describe("buildStableValueUrl", () => {
  it("uses the published row key and forwards every source parameter", () => {
    const result = buildStableValueUrl({
      apiBaseUrl: "https://hunt.data.lisacorp.com",
      source: "stablecoins",
      sourceUrl:
        "https://hunt.data.lisacorp.com/stablecoins/balances.csv" +
        "?address=0x6272ab4f91e0df14acb6a2a311d817381210e339" +
        "&wallet=4hgKXUgyETQVxEf1HXoDYHnoJXey37Y9Srkrp6kjwwDp",
      rows,
      rowIndex: 1,
      columnIndex: 2,
      keyColumn: "balance_id",
    });
    const url = new URL(result);

    expect(url.pathname).toBe("/value");
    expect(url.searchParams.get("source")).toBe("stablecoins");
    expect(url.searchParams.get("key")).toBe(rows[1][0]);
    expect(url.searchParams.get("column")).toBe("balance");
    expect(url.searchParams.get("address")).toBe(
      "0x6272ab4f91e0df14acb6a2a311d817381210e339"
    );
    expect(url.searchParams.get("wallet")).toBe(
      "4hgKXUgyETQVxEf1HXoDYHnoJXey37Y9Srkrp6kjwwDp"
    );
  });

  it("does not create a stable URL for a header or missing key column", () => {
    const options = {
      apiBaseUrl: "https://hunt.data.lisacorp.com",
      source: "stablecoins",
      sourceUrl: "https://hunt.data.lisacorp.com/stablecoins/balances.csv",
      rows,
      columnIndex: 2,
    };

    expect(
      buildStableValueUrl({
        ...options,
        rowIndex: 0,
        keyColumn: "balance_id",
      })
    ).toBe("");
    expect(
      buildStableValueUrl({
        ...options,
        rowIndex: 1,
        keyColumn: "missing",
      })
    ).toBe("");
  });

  it("forwards the encrypted Coinbase access key to the stable value route", () => {
    const coinbaseRows = [
      ["id", "name", "balance"],
      ["coinbase:total_balance", "total_balance", "3596.50"],
    ];
    const result = buildStableValueUrl({
      apiBaseUrl: "https://hunt.data.lisacorp.com",
      source: "coinbase",
      sourceUrl:
        "https://hunt.data.lisacorp.com/coinbase/balance?" +
        "capsule=dhc1.v1.main&intx_capsule=dhc1.v1.intx&include_portfolios=true",
      rows: coinbaseRows,
      rowIndex: 1,
      columnIndex: 2,
      keyColumn: "id",
    });
    const url = new URL(result);

    expect(url.pathname).toBe("/value");
    expect(url.searchParams.get("capsule")).toBe("dhc1.v1.main");
    expect(url.searchParams.get("intx_capsule")).toBe("dhc1.v1.intx");
    expect(url.searchParams.get("key")).toBe("coinbase:total_balance");
    expect(url.searchParams.get("column")).toBe("balance");
  });
});


describe("short value resources", () => {
  it("stores a multi-wallet stablecoin selection in one resource", () => {
    const descriptor = buildValueResourceDescriptor({
      source: "stablecoins",
      sourceUrl:
        "https://hunt.data.lisacorp.com/stablecoins/balances.csv?" +
        "address=0x6272ab4f91e0df14acb6a2a311d817381210e339%2C" +
        "0x94ce9ae15c739552eebb8a8746c0ca33c3d369ce&chain_id=1",
      rows,
      rowIndex: 1,
      columnIndex: 2,
      keyColumn: "balance_id",
      credentialParameters: [],
    });

    expect(descriptor?.request.parameters).toEqual({
      address:
        "0x6272ab4f91e0df14acb6a2a311d817381210e339," +
        "0x94ce9ae15c739552eebb8a8746c0ca33c3d369ce",
      chain_id: "1",
    });
  });

  it("keeps credentials out of the stored resource request", () => {
    const descriptor = buildValueResourceDescriptor({
      source: "coinbase",
      sourceUrl:
        "https://hunt.data.lisacorp.com/coinbase/balance?" +
        "capsule=dhc1.v2.main&intx_capsule=dhc1.v2.intx&include_portfolios=true",
      rows: [
        ["id", "balance"],
        ["coinbase:total_balance", "3596.50"],
      ],
      rowIndex: 1,
      columnIndex: 1,
      keyColumn: "id",
      credentialParameters: ["capsule", "intx_capsule"],
    });

    expect(descriptor).toEqual({
      request: {
        source: "coinbase",
        key: "coinbase:total_balance",
        column: "balance",
        parameters: { include_portfolios: "true" },
      },
      credentials: {
        capsule: "dhc1.v2.main",
        intx_capsule: "dhc1.v2.intx",
      },
    });
  });

  it("creates a direct descriptor for an already scalar source", () => {
    const descriptor = buildValueResourceDescriptor({
      source: "cmc-price",
      sourceUrl: "https://hunt.data.lisacorp.com/cmc/price.csv?symbol=ETH",
      rows: [["2500.12"]],
      rowIndex: 0,
      columnIndex: 0,
      credentialParameters: [],
    });

    expect(descriptor?.request).toEqual({
      source: "cmc-price",
      parameters: { symbol: "ETH" },
    });
  });

  it("builds a short URL with credentials and scoped user token", () => {
    expect(
      buildShortValueUrl({
        apiBaseUrl: "https://hunt.data.lisacorp.com",
        resourceId: "AbCdEf123456",
        credentials: { capsule: "dhc1.v2.encrypted" },
        userToken: "signed-sheets-token",
      })
    ).toBe(
      "https://hunt.data.lisacorp.com/v/AbCdEf123456?" +
        "capsule=dhc1.v2.encrypted&auth_token=signed-sheets-token"
    );
  });
});


describe("buildImportFormula", () => {
  it("imports a stable value as exactly one cell", () => {
    const formula = buildImportFormula({
      url: "https://hunt.data.lisacorp.com/stablecoins/balances.csv",
      stableUrl:
        "https://hunt.data.lisacorp.com/value?source=stablecoins&key=id&column=balance",
      rows,
      rowIndex: 1,
      columnIndex: 2,
      separator: ";",
      keyColumn: "balance_id",
      stable: true,
    });

    expect(formula).toBe(
      '=INDEX(IMPORTDATA("https://hunt.data.lisacorp.com/value?' +
        'source=stablecoins&key=id&column=balance");1;1)'
    );
  });

  it("falls back to an explicit row and column when stable mode is disabled", () => {
    expect(
      buildImportFormula({
        url: "https://hunt.data.lisacorp.com/table.csv",
        rows,
        rowIndex: 1,
        columnIndex: 2,
        separator: ",",
        keyColumn: "balance_id",
        stable: false,
      })
    ).toBe(
      '=INDEX(IMPORTDATA("https://hunt.data.lisacorp.com/table.csv"),2,3)'
    );
  });

  it("keeps a one-cell response constrained to one imported cell", () => {
    expect(
      buildImportFormula({
        url: "https://hunt.data.lisacorp.com/value?column=balance",
        rows: [["42"]],
        rowIndex: 0,
        columnIndex: 0,
        separator: ";",
        stable: true,
      })
    ).toBe(
      '=INDEX(IMPORTDATA("https://hunt.data.lisacorp.com/value?' +
        'column=balance");1;1)'
    );
  });

  it("escapes quotes before putting a URL into a Sheets formula", () => {
    expect(escapeFormulaText('https://example.com/?value="quoted"')).toBe(
      'https://example.com/?value=""quoted""'
    );
  });
});
