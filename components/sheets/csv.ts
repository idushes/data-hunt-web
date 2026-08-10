export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(
    (currentRow) =>
      currentRow.length > 1 || currentRow.some((value) => value.trim() !== "")
  );
}

export function escapeFormulaText(value: string) {
  return value.replaceAll('"', '""');
}

type FormulaOptions = {
  url: string;
  stableUrl?: string;
  rows: string[][];
  rowIndex: number;
  columnIndex: number;
  separator: "," | ";";
  keyColumn?: string;
  stable: boolean;
};

export function buildImportFormula({
  url,
  stableUrl,
  rows,
  rowIndex,
  columnIndex,
  separator,
  keyColumn,
  stable,
}: FormulaOptions) {
  const escapedUrl = escapeFormulaText(url);
  if (rows.length === 1 && rows[0]?.length === 1) {
    const singleCellUrl =
      stable && stableUrl ? escapeFormulaText(stableUrl) : escapedUrl;
    return `=INDEX(IMPORTDATA("${singleCellUrl}")${separator}1${separator}1)`;
  }

  if (stable && stableUrl) {
    return `=INDEX(IMPORTDATA("${escapeFormulaText(stableUrl)}")${separator}1${separator}1)`;
  }

  const header = rows[0] ?? [];
  const keyColumnIndex = keyColumn ? header.indexOf(keyColumn) : -1;
  const keyValue = rows[rowIndex]?.[keyColumnIndex] ?? "";
  const columnName = header[columnIndex] ?? "";
  const canUseStableFormula =
    stable &&
    rowIndex > 0 &&
    keyColumnIndex >= 0 &&
    keyValue !== "" &&
    columnName !== "";

  if (canUseStableFormula) {
    const key = escapeFormulaText(keyValue);
    const column = escapeFormulaText(columnName);
    const s = separator;
    return `=LET(data${s}IMPORTDATA("${escapedUrl}")${s}INDEX(data${s}MATCH("${key}"${s}INDEX(data${s}0${s}${keyColumnIndex + 1})${s}0)${s}MATCH("${column}"${s}INDEX(data${s}1${s}0)${s}0)))`;
  }

  return `=INDEX(IMPORTDATA("${escapedUrl}")${separator}${rowIndex + 1}${separator}${columnIndex + 1})`;
}

type StableValueUrlOptions = {
  apiBaseUrl: string;
  source: string;
  sourceUrl: string;
  rows: string[][];
  rowIndex: number;
  columnIndex: number;
  keyColumn?: string;
};

export function buildStableValueUrl({
  apiBaseUrl,
  source,
  sourceUrl,
  rows,
  rowIndex,
  columnIndex,
  keyColumn,
}: StableValueUrlOptions) {
  if (!keyColumn || rowIndex <= 0) return "";

  const header = rows[0] ?? [];
  const keyColumnIndex = header.indexOf(keyColumn);
  const key = rows[rowIndex]?.[keyColumnIndex] ?? "";
  const column = header[columnIndex] ?? "";
  if (keyColumnIndex < 0 || !key || !column) return "";

  const valueUrl = new URL("/value", apiBaseUrl);
  valueUrl.searchParams.set("source", source);
  valueUrl.searchParams.set("key", key);
  valueUrl.searchParams.set("column", column);

  const originalUrl = new URL(sourceUrl);
  originalUrl.searchParams.forEach((value, name) => {
    valueUrl.searchParams.append(name, value);
  });

  return valueUrl.toString();
}

export type ValueResourceRequest = {
  source: string;
  key?: string;
  column?: string;
  parameters: Record<string, string>;
};

export type ValueResourceDescriptor = {
  request: ValueResourceRequest;
  credentials: Record<string, string>;
};

type ValueResourceDescriptorOptions = {
  source: string;
  sourceUrl: string;
  rows: string[][];
  rowIndex: number;
  columnIndex: number;
  keyColumn?: string;
  credentialParameters: string[];
};

export function buildValueResourceDescriptor({
  source,
  sourceUrl,
  rows,
  rowIndex,
  columnIndex,
  keyColumn,
  credentialParameters,
}: ValueResourceDescriptorOptions): ValueResourceDescriptor | null {
  const isDirectSingleCell =
    rows.length === 1 &&
    rows[0]?.length === 1 &&
    rowIndex === 0 &&
    columnIndex === 0;
  const header = rows[0] ?? [];
  const keyColumnIndex = keyColumn ? header.indexOf(keyColumn) : -1;
  const key = rows[rowIndex]?.[keyColumnIndex] ?? "";
  const column = header[columnIndex] ?? "";
  const isStableCell =
    rowIndex > 0 && keyColumnIndex >= 0 && key !== "" && column !== "";
  if (!isDirectSingleCell && !isStableCell) return null;

  const credentialNames = new Set(credentialParameters);
  const parameters: Record<string, string> = {};
  const credentials: Record<string, string> = {};
  const originalUrl = new URL(sourceUrl);
  originalUrl.searchParams.forEach((value, name) => {
    if (credentialNames.has(name)) {
      credentials[name] = value;
    } else {
      parameters[name] = value;
    }
  });

  return {
    request: {
      source,
      ...(isStableCell ? { key, column } : {}),
      parameters,
    },
    credentials,
  };
}

export function buildShortValueUrl({
  apiBaseUrl,
  resourceId,
  credentials,
  userToken,
}: {
  apiBaseUrl: string;
  resourceId: string;
  credentials: Record<string, string>;
  userToken?: string;
}) {
  const url = new URL(`/v/${encodeURIComponent(resourceId)}`, apiBaseUrl);
  for (const [name, value] of Object.entries(credentials)) {
    url.searchParams.set(name, value);
  }
  if (userToken) url.searchParams.set("auth_token", userToken);
  return url.toString();
}
