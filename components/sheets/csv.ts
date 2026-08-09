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
  rows: string[][];
  rowIndex: number;
  columnIndex: number;
  separator: "," | ";";
  keyColumn?: string;
  stable: boolean;
};

export function buildImportFormula({
  url,
  rows,
  rowIndex,
  columnIndex,
  separator,
  keyColumn,
  stable,
}: FormulaOptions) {
  const escapedUrl = escapeFormulaText(url);
  if (rows.length === 1 && rows[0]?.length === 1) {
    return `=IMPORTDATA("${escapedUrl}")`;
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
