"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  initialParameterValues,
  sheetSources,
  type SheetParameter,
} from "@/components/sheets/catalog";
import {
  buildImportFormula,
  buildStableValueUrl,
  parseCsv,
} from "@/components/sheets/csv";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://hunt.data.lisacorp.com"
).replace(/\/$/, "");

type SelectedCell = {
  row: number;
  column: number;
};

type CopyTarget = "formula" | "value" | "url";

type AddressKind = "evm" | "solana";

type SavedAddress = {
  id: string;
  kind: AddressKind;
  label: string;
  value: string;
};

const SAVED_ADDRESSES_KEY = "datahunt:sheets:saved-addresses:v1";
const SAVED_ADDRESSES_EVENT = "datahunt:sheets:saved-addresses-changed";
const EMPTY_SAVED_ADDRESSES = "[]";

function savedAddressesSnapshot() {
  return localStorage.getItem(SAVED_ADDRESSES_KEY) ?? EMPTY_SAVED_ADDRESSES;
}

function serverSavedAddressesSnapshot() {
  return EMPTY_SAVED_ADDRESSES;
}

function subscribeToSavedAddresses(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === SAVED_ADDRESSES_KEY) onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(SAVED_ADDRESSES_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SAVED_ADDRESSES_EVENT, onStoreChange);
  };
}

function parseSavedAddresses(content: string): SavedAddress[] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SavedAddress => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<SavedAddress>;
      return (
        typeof candidate.id === "string" &&
        (candidate.kind === "evm" || candidate.kind === "solana") &&
        typeof candidate.label === "string" &&
        typeof candidate.value === "string"
      );
    });
  } catch {
    return [];
  }
}

function useSavedAddresses() {
  const snapshot = useSyncExternalStore(
    subscribeToSavedAddresses,
    savedAddressesSnapshot,
    serverSavedAddressesSnapshot
  );
  return useMemo(() => parseSavedAddresses(snapshot), [snapshot]);
}

function storeSavedAddresses(addresses: SavedAddress[]) {
  localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(addresses));
  window.dispatchEvent(new Event(SAVED_ADDRESSES_EVENT));
}

function addressKind(parameter: SheetParameter): AddressKind | null {
  if (parameter.key === "wallet") return "solana";
  if (parameter.key === "address") return "evm";
  return null;
}

function normalizedAddress(value: string, kind: AddressKind) {
  const trimmed = value.trim();
  return kind === "evm" ? trimmed.toLowerCase() : trimmed;
}

function validAddress(value: string, kind: AddressKind) {
  const trimmed = value.trim();
  if (kind === "evm") return /^0x[0-9a-fA-F]{40}$/.test(trimmed);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
}

function shortAddress(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 7)}…${value.slice(-6)}`;
}

function parameterInputClass() {
  return "mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10";
}

function errorMessage(content: string) {
  try {
    const parsed = JSON.parse(content) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (parsed.detail) return JSON.stringify(parsed.detail);
  } catch {
    // The API can return a plain-text error.
  }
  return content || "Не удалось загрузить данные";
}

function ParameterField({
  parameter,
  value,
  onChange,
}: {
  parameter: SheetParameter;
  value: string;
  onChange: (value: string) => void;
}) {
  if (parameter.kind === "boolean") {
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-3.5">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(event) => onChange(String(event.target.checked))}
          className="mt-0.5 h-4 w-4 accent-violet-500"
        />
        <span className="text-sm text-zinc-300">{parameter.label}</span>
      </label>
    );
  }

  return (
    <label className="block text-sm text-zinc-300">
      <span className="flex items-center gap-1.5">
        {parameter.label}
        {parameter.required ? (
          <span className="text-amber-300" aria-label="обязательное поле">
            *
          </span>
        ) : null}
      </span>
      {parameter.kind === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={parameterInputClass()}
        >
          {parameter.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : parameter.kind === "textarea" ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={parameter.placeholder}
          rows={4}
          spellCheck={false}
          className={`${parameterInputClass()} resize-y font-mono text-xs`}
        />
      ) : (
        <input
          type={
            parameter.kind === "secret"
              ? "password"
              : parameter.kind === "number"
                ? "number"
                : "text"
          }
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={parameter.placeholder}
          autoComplete="off"
          spellCheck={false}
          className={parameterInputClass()}
        />
      )}
      {parameter.help ? (
        <span className="mt-1.5 block text-xs leading-5 text-zinc-500">
          {parameter.help}
        </span>
      ) : null}
    </label>
  );
}

function SavedAddressPicker({
  kind,
  value,
  onChange,
  onError,
}: {
  kind: AddressKind;
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const allAddresses = useSavedAddresses();
  const addresses = allAddresses.filter((address) => address.kind === kind);
  const normalizedValue = normalizedAddress(value, kind);
  const selectedAddress = addresses.find(
    (address) => normalizedAddress(address.value, kind) === normalizedValue
  );

  function selectAddress(id: string) {
    const address = addresses.find((candidate) => candidate.id === id);
    if (!address) return;
    onChange(address.value);
    onError("");
  }

  function saveAddress() {
    const trimmed = value.trim();
    if (!validAddress(trimmed, kind)) {
      onError(
        kind === "evm"
          ? "Введите корректный EVM-адрес перед сохранением."
          : "Введите корректный Solana-адрес перед сохранением."
      );
      return;
    }

    const existing = allAddresses.find(
      (address) =>
        address.kind === kind &&
        normalizedAddress(address.value, kind) === normalizedAddress(trimmed, kind)
    );
    const defaultLabel = existing?.label ?? shortAddress(trimmed);
    const label = window.prompt("Название для адреса", defaultLabel)?.trim();
    if (label === undefined) return;

    const nextAddress: SavedAddress = {
      id: existing?.id ?? `${kind}:${normalizedAddress(trimmed, kind)}`,
      kind,
      label: label || defaultLabel,
      value: trimmed,
    };
    const nextAddresses = existing
      ? allAddresses.map((address) =>
          address.id === existing.id ? nextAddress : address
        )
      : [...allAddresses, nextAddress];

    storeSavedAddresses(nextAddresses);
    onChange(trimmed);
    onError("");
  }

  function removeAddress() {
    if (!selectedAddress) return;
    const confirmed = window.confirm(
      `Удалить «${selectedAddress.label}» из сохранённых адресов?`
    );
    if (!confirmed) return;

    storeSavedAddresses(
      allAddresses.filter((address) => address.id !== selectedAddress.id)
    );
    onError("");
  }

  return (
    <div className="mt-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5">
      <div className="flex gap-2">
        <select
          aria-label={
            kind === "evm" ? "Сохранённые EVM-адреса" : "Сохранённые Solana-адреса"
          }
          value={selectedAddress?.id ?? ""}
          onChange={(event) => selectAddress(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-zinc-300 outline-none transition focus:border-violet-400/50"
        >
          <option value="">
            {addresses.length > 0
              ? "Выбрать сохранённый адрес"
              : "Сохранённых адресов пока нет"}
          </option>
          {addresses.map((address) => (
            <option key={address.id} value={address.id}>
              {address.label} · {shortAddress(address.value)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={saveAddress}
          disabled={!value.trim()}
          className="shrink-0 rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selectedAddress ? "Переименовать" : "Сохранить"}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 px-1">
        <span className="text-[11px] text-zinc-600">
          Только в localStorage этого браузера
        </span>
        {selectedAddress ? (
          <button
            type="button"
            onClick={removeAddress}
            className="text-[11px] text-zinc-500 transition hover:text-red-300"
          >
            Удалить
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function SheetsBuilder() {
  const defaultSource = sheetSources[0];
  const [sourceId, setSourceId] = useState(defaultSource.id);
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialParameterValues(defaultSource)
  );
  const [rows, setRows] = useState<string[][]>([]);
  const [loadedUrl, setLoadedUrl] = useState("");
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [separator, setSeparator] = useState<"," | ";">(";");
  const [stableFormula, setStableFormula] = useState(true);

  const source =
    sheetSources.find((candidate) => candidate.id === sourceId) ?? defaultSource;

  const groups = useMemo(
    () => Array.from(new Set(sheetSources.map((candidate) => candidate.group))),
    []
  );

  const selectedValue = selectedCell
    ? (rows[selectedCell.row]?.[selectedCell.column] ?? "")
    : "";
  const selectedHeader = selectedCell
    ? (rows[0]?.[selectedCell.column] ?? `Столбец ${selectedCell.column + 1}`)
    : "";
  const supportsStableFormula = Boolean(
    selectedCell &&
      selectedCell.row > 0 &&
      source.keyColumn &&
      rows[0]?.includes(source.keyColumn) &&
      rows[selectedCell.row]?.[rows[0].indexOf(source.keyColumn)]
  );
  const stableValueUrl =
    selectedCell && loadedUrl && supportsStableFormula
      ? buildStableValueUrl({
          apiBaseUrl: API_BASE_URL,
          source: source.id,
          sourceUrl: loadedUrl,
          rows,
          rowIndex: selectedCell.row,
          columnIndex: selectedCell.column,
          keyColumn: source.keyColumn,
        })
      : "";
  const selectedImportUrl =
    stableFormula && stableValueUrl ? stableValueUrl : loadedUrl;

  const formula =
    selectedCell && loadedUrl
      ? buildImportFormula({
          url: loadedUrl,
          stableUrl: stableValueUrl,
          rows,
          rowIndex: selectedCell.row,
          columnIndex: selectedCell.column,
          separator,
          keyColumn: source.keyColumn,
          stable: stableFormula && supportsStableFormula,
        })
      : "";

  function changeSource(nextSourceId: string) {
    const nextSource =
      sheetSources.find((candidate) => candidate.id === nextSourceId) ??
      defaultSource;
    const nextValues = initialParameterValues(nextSource);

    if (nextSource.usesDataHuntToken) {
      nextValues.token = localStorage.getItem("data_hunt_token") ?? "";
    }

    setSourceId(nextSource.id);
    setValues(nextValues);
    setRows([]);
    setLoadedUrl("");
    setSelectedCell(null);
    setError("");
    setCopied(null);
    setStableFormula(true);
  }

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function useAccountToken() {
    const token = localStorage.getItem("data_hunt_token") ?? "";
    if (!token) {
      setError("Сначала войдите в DataHunt, чтобы подставить токен аккаунта.");
      return;
    }
    updateValue("token", token);
    setError("");
  }

  function validate() {
    const missing = source.parameters.find(
      (parameter) => parameter.required && !values[parameter.key]?.trim()
    );
    if (missing) return `Заполните поле «${missing.label}».`;

    if (
      source.requiredAny &&
      !source.requiredAny.some((key) => values[key]?.trim())
    ) {
      const labels = source.requiredAny.map(
        (key) =>
          source.parameters.find((parameter) => parameter.key === key)?.label ?? key
      );
      return `Заполните хотя бы одно поле: ${labels.join(", ")}.`;
    }

    return "";
  }

  function buildUrl() {
    const url = new URL(source.path, API_BASE_URL);
    for (const parameter of source.parameters) {
      const value = values[parameter.key]?.trim() ?? "";
      if (value !== "") url.searchParams.set(parameter.key, value);
    }
    return url.toString();
  }

  async function loadTable() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const url = buildUrl();
    setLoading(true);
    setError("");
    setRows([]);
    setSelectedCell(null);
    setCopied(null);

    try {
      const response = await fetch(url, { cache: "no-store" });
      const content = await response.text();
      if (!response.ok) throw new Error(errorMessage(content));

      const contentType = response.headers.get("content-type") ?? "";
      const nextRows = contentType.includes("text/csv")
        ? parseCsv(content)
        : [[content.trim()]];

      if (nextRows.length === 0) {
        throw new Error("API вернул пустую таблицу.");
      }

      setRows(nextRows);
      setLoadedUrl(url);
      if (nextRows.length === 1 && nextRows[0]?.length === 1) {
        setSelectedCell({ row: 0, column: 0 });
      }
    } catch (caught) {
      setLoadedUrl("");
      setError(
        caught instanceof Error ? caught.message : "Не удалось загрузить таблицу"
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, target: CopyTarget) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Браузер не разрешил копирование. Выделите текст вручную.");
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-16 pt-24 text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-20 h-72 w-72 rounded-full bg-violet-600/10 blur-[110px]" />
        <div className="absolute right-[6%] top-56 h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1800px]">
        <div className="mb-8 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-violet-200">
            Google Sheets helper
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Одна нужная цифра — сразу в таблицу
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-400 sm:text-lg">
            Выберите источник, загрузите данные и нажмите на нужную ячейку.
            Конструктор соберёт формулу, которую можно вставить прямо в Google
            Sheets.
          </p>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-medium text-white">1. Источник данных</h2>
              <span className="text-xs text-zinc-500">{sheetSources.length} CSV</span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
              <div>
                <label className="block text-sm text-zinc-300">
                  Таблица
                  <select
                    value={source.id}
                    onChange={(event) => changeSource(event.target.value)}
                    className={parameterInputClass()}
                  >
                    {groups.map((group) => (
                      <optgroup key={group} label={group}>
                        {sheetSources
                          .filter((candidate) => candidate.group === group)
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  {source.description}
                </p>
              </div>

              <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {source.parameters.map((parameter) => {
                  const kind = addressKind(parameter);
                  return (
                    <div key={parameter.key} className="min-w-0">
                      <ParameterField
                        parameter={parameter}
                        value={values[parameter.key] ?? ""}
                        onChange={(value) => updateValue(parameter.key, value)}
                      />
                      {kind ? (
                        <SavedAddressPicker
                          kind={kind}
                          value={values[parameter.key] ?? ""}
                          onChange={(value) => updateValue(parameter.key, value)}
                          onError={setError}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-xs leading-5 text-zinc-600">
                Токены и ключи попадут в URL формулы. Не публикуйте лист с такими
                формулами и не давайте к нему общий доступ.
              </p>

              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                {source.usesDataHuntToken ? (
                  <button
                    type="button"
                    onClick={useAccountToken}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    Подставить токен аккаунта
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={loadTable}
                  disabled={loading}
                  className="flex min-w-48 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : null}
                  {loading ? "Загружаю…" : "Загрузить таблицу"}
                </button>
              </div>
            </div>
          </section>

          <div className="min-w-0 space-y-6">
            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm text-red-200"
              >
                {error}
              </div>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
              <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-medium text-white">2. Выберите ячейку</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Кликните по любому значению, которое хотите получать в Sheets.
                  </p>
                </div>
                {rows.length > 0 ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{Math.max(0, rows.length - 1)} строк</span>
                    <span className="text-zinc-700">•</span>
                    <span>{rows[0]?.length ?? 0} столбцов</span>
                  </div>
                ) : null}
              </div>

              {rows.length > 0 ? (
                <div className="max-h-[640px] overflow-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr key={`${rowIndex}-${row[0] ?? "row"}`}>
                          {row.map((cell, columnIndex) => {
                            const active =
                              selectedCell?.row === rowIndex &&
                              selectedCell.column === columnIndex;
                            const CellTag = rowIndex === 0 ? "th" : "td";
                            return (
                              <CellTag
                                key={`${columnIndex}-${cell}`}
                                className={`border-b border-r border-white/[0.07] bg-black/30 p-0 ${
                                  rowIndex === 0 ? "sticky top-0 z-20 bg-zinc-950" : ""
                                } ${
                                  columnIndex === 0
                                    ? "sticky left-0 z-10 bg-zinc-950"
                                    : ""
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedCell({
                                      row: rowIndex,
                                      column: columnIndex,
                                    })
                                  }
                                  className={`block min-w-full whitespace-nowrap px-3 py-2.5 text-left outline-none transition ${
                                    rowIndex === 0
                                      ? "font-medium text-zinc-300"
                                      : "font-mono text-zinc-400 hover:bg-violet-400/10 hover:text-white"
                                  } ${
                                    active
                                      ? "bg-violet-500/20 text-violet-100 ring-1 ring-inset ring-violet-400/70"
                                      : ""
                                  }`}
                                  title={cell}
                                >
                                  {cell || <span className="text-zinc-700">пусто</span>}
                                </button>
                              </CellTag>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 font-mono text-lg text-zinc-500">
                    fx
                  </div>
                  <p className="text-sm text-zinc-400">Таблица появится здесь</p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-600">
                    Заполните параметры сверху и нажмите «Загрузить таблицу».
                  </p>
                </div>
              )}
            </section>

            {selectedCell && formula ? (
              <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.09] to-blue-500/[0.04] p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-violet-300">
                      Выбрано
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      {selectedHeader || "Единственное значение"}
                    </h2>
                    <p className="mt-1 max-w-xl break-all font-mono text-sm text-zinc-400">
                      {selectedValue || "пустая ячейка"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(selectedValue, "value")}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  >
                    {copied === "value" ? "Значение скопировано" : "Копировать значение"}
                  </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {supportsStableFormula ? (
                    <label className="text-xs text-zinc-400">
                      Способ получения значения
                      <select
                        value={stableFormula ? "stable" : "position"}
                        onChange={(event) =>
                          setStableFormula(event.target.value === "stable")
                        }
                        className={parameterInputClass()}
                      >
                        <option value="stable">
                          Прямой value-route по ID
                        </option>
                        <option value="position">По номеру строки и столбца</option>
                      </select>
                    </label>
                  ) : null}

                  <label className="text-xs text-zinc-400">
                    Разделитель аргументов в вашем Sheets
                    <select
                      value={separator}
                      onChange={(event) =>
                        setSeparator(event.target.value as "," | ";")
                      }
                      className={parameterInputClass()}
                    >
                      <option value=";">Точка с запятой ;</option>
                      <option value=",">Запятая ,</option>
                    </select>
                  </label>
                </div>

                <label className="mt-5 block text-xs text-zinc-400">
                  Готовая формула
                  <textarea
                    readOnly
                    value={formula}
                    onFocus={(event) => event.target.select()}
                    rows={5}
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs leading-5 text-violet-100 outline-none focus:border-violet-400/50"
                  />
                </label>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => copyText(formula, "formula")}
                    className="flex-1 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-violet-100"
                  >
                    {copied === "formula"
                      ? "Формула скопирована"
                      : "Скопировать формулу для Google Sheets"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(selectedImportUrl, "url")}
                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  >
                    {copied === "url"
                      ? "URL скопирован"
                      : stableFormula && stableValueUrl
                        ? "Копировать value URL"
                        : "Копировать CSV URL"}
                  </button>
                </div>

                <p className="mt-4 text-xs leading-5 text-zinc-500">
                  {stableFormula && stableValueUrl
                    ? "Value-route каждый раз находит строку по постоянному ID и возвращает только эту ячейку. Порядок и количество строк в исходной таблице не влияют на ссылку."
                    : "Вставьте формулу в пустую ячейку Google Sheets. Сервер держит CSV в памяти минимум 60 секунд; Google Sheets может обновлять импорт по собственному расписанию."}
                </p>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
