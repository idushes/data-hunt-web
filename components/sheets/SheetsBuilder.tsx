"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  initialParameterValues,
  sheetSources,
  type SheetParameter,
} from "@/components/sheets/catalog";
import {
  buildImportFormula,
  buildShortValueUrl,
  buildStableValueUrl,
  buildValueResourceDescriptor,
  parseCsv,
} from "@/components/sheets/csv";
import {
  parseAuthorizedWallets,
  type AuthorizedWallet,
} from "@/components/sheets/addresses";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://hunt.data.lisacorp.com"
).replace(/\/$/, "");

type SelectedCell = {
  row: number;
  column: number;
};

type CopyTarget =
  | "formula"
  | "value"
  | "url"
  | "coinbase-main"
  | "coinbase-intx";

type AddressKind = "evm" | "solana" | "tron";

type SavedAddress = {
  id: string;
  kind: AddressKind;
  label: string;
  value: string;
};

const SAVED_ADDRESSES_KEY = "datahunt:sheets:saved-addresses:v1";
const SAVED_ADDRESSES_EVENT = "datahunt:sheets:saved-addresses-changed";
const AUTH_CHANGED_EVENT = "data-hunt-auth";
const EMPTY_SAVED_ADDRESSES = "[]";
const COINBASE_CAPSULE_STORAGE_KEY = "datahunt:coinbase:capsule:v1";
const COINBASE_INTX_CAPSULE_STORAGE_KEY =
  "datahunt:coinbase:intx-capsule:v1";
const SHEETS_ACCESS_STORAGE_KEY = "datahunt:sheets:access:v1";

type StoredSheetsAccess = {
  accountId: string;
  token: string;
};

function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(base64 + padding));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function storedSheetsAccess(): StoredSheetsAccess | null {
  try {
    const content = localStorage.getItem(SHEETS_ACCESS_STORAGE_KEY);
    if (!content) return null;
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<StoredSheetsAccess>;
    if (
      typeof candidate.accountId !== "string" ||
      typeof candidate.token !== "string"
    ) {
      return null;
    }
    return { accountId: candidate.accountId, token: candidate.token };
  } catch {
    return null;
  }
}

async function sheetsAccessToken(loginToken: string) {
  const payload = jwtPayload(loginToken);
  const accountId = typeof payload?.sub === "string" ? payload.sub : "";
  if (!accountId) return "";

  const stored = storedSheetsAccess();
  if (stored?.accountId === accountId) return stored.token;

  const expiresAt = typeof payload?.exp === "number" ? payload.exp : 0;
  if (expiresAt <= Date.now() / 1000) return "";

  const response = await fetch(`${API_BASE_URL}/web3/sheets-token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${loginToken}` },
    cache: "no-store",
  });
  const content = await response.text();
  if (!response.ok) throw new Error(errorMessage(content));
  const result = JSON.parse(content) as {
    access_token?: unknown;
    account_id?: unknown;
  };
  if (
    typeof result.access_token !== "string" ||
    typeof result.account_id !== "string"
  ) {
    throw new Error("The API did not return a Sheets access token.");
  }

  localStorage.setItem(
    SHEETS_ACCESS_STORAGE_KEY,
    JSON.stringify({ accountId: result.account_id, token: result.access_token })
  );
  return result.access_token;
}

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
        (candidate.kind === "evm" ||
          candidate.kind === "solana" ||
          candidate.kind === "tron") &&
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

function useAuthorizedWallets() {
  const [wallets, setWallets] = useState<AuthorizedWallet[]>([]);

  useEffect(() => {
    let active = true;

    async function loadWallets() {
      const token = localStorage.getItem("data_hunt_token");
      if (!token) {
        if (active) setWallets([]);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/web3/addresses`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) {
          if (active) setWallets([]);
          return;
        }
        const payload: unknown = await response.json();
        if (active) setWallets(parseAuthorizedWallets(payload));
      } catch {
        if (active) setWallets([]);
      }
    }

    function refreshWallets() {
      void loadWallets();
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === "data_hunt_token") refreshWallets();
    }

    refreshWallets();
    window.addEventListener(AUTH_CHANGED_EVENT, refreshWallets);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refreshWallets);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, refreshWallets);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refreshWallets);
    };
  }, []);

  return wallets;
}

function storeSavedAddresses(addresses: SavedAddress[]) {
  localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(addresses));
  window.dispatchEvent(new Event(SAVED_ADDRESSES_EVENT));
}

function addressKind(parameter: SheetParameter): AddressKind | null {
  if (parameter.key === "wallet") return "solana";
  if (parameter.key === "address") return "evm";
  if (parameter.key === "tron_address") return "tron";
  return null;
}

function normalizedAddress(value: string, kind: AddressKind) {
  const trimmed = value.trim();
  return kind === "evm" ? trimmed.toLowerCase() : trimmed;
}

function validAddress(value: string, kind: AddressKind) {
  const trimmed = value.trim();
  if (kind === "evm") return /^0x[0-9a-fA-F]{40}$/.test(trimmed);
  if (kind === "tron") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
}

function shortAddress(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 7)}…${value.slice(-6)}`;
}

function parameterInputClass() {
  return "mt-1.5 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10";
}

function errorMessage(content: string) {
  try {
    const parsed = JSON.parse(content) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (parsed.detail) return JSON.stringify(parsed.detail);
  } catch {
    // The API can return a plain-text error.
  }
  return content || "Unable to load data";
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
      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(event) => onChange(String(event.target.checked))}
          className="h-4 w-4 accent-violet-500"
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
          <span className="text-amber-300" aria-label="required field">
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
          rows={3}
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
        <span className="mt-1 block text-xs leading-4 text-zinc-500">
          {parameter.help}
        </span>
      ) : null}
    </label>
  );
}

function AddressField({
  parameter,
  kind,
  value,
  authorizedWallets,
  onChange,
  onError,
}: {
  parameter: SheetParameter;
  kind: AddressKind;
  value: string;
  authorizedWallets: AuthorizedWallet[];
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const allAddresses = useSavedAddresses();
  const addresses = allAddresses.filter((address) => address.kind === kind);
  const accountWallets = kind === "evm" ? authorizedWallets : [];
  const normalizedValue = normalizedAddress(value, kind);
  const selectedAddress = addresses.find(
    (address) => normalizedAddress(address.value, kind) === normalizedValue
  );

  function selectAddress(address: string) {
    if (!address) return;
    onChange(address);
    onError("");
  }

  function saveAddress() {
    const trimmed = value.trim();
    if (!validAddress(trimmed, kind)) {
      onError(
        kind === "evm"
          ? "Enter a valid EVM address before saving."
          : kind === "tron"
            ? "Enter a valid TRON address before saving."
            : "Enter a valid Solana address before saving."
      );
      return;
    }

    const existing = allAddresses.find(
      (address) =>
        address.kind === kind &&
        normalizedAddress(address.value, kind) === normalizedAddress(trimmed, kind)
    );
    const defaultLabel = existing?.label ?? shortAddress(trimmed);
    const label = window.prompt("Label for this address", defaultLabel)?.trim();
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
      `Remove “${selectedAddress.label}” from saved addresses?`
    );
    if (!confirmed) return;

    storeSavedAddresses(
      allAddresses.filter((address) => address.id !== selectedAddress.id)
    );
    onError("");
  }

  return (
    <label className="block text-sm text-zinc-300">
      <span className="flex items-center gap-1.5">
        {parameter.label}
        {parameter.required ? (
          <span className="text-amber-300" aria-label="required field">
            *
          </span>
        ) : null}
      </span>
      <div className="mt-1.5 flex min-w-0 gap-1.5">
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-black/50 transition focus-within:border-violet-400/60 focus-within:ring-2 focus-within:ring-violet-400/10">
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={parameter.placeholder}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
          />
          {accountWallets.length > 0 || addresses.length > 0 ? (
            <span className="relative flex w-11 shrink-0 border-l border-white/10 bg-white/[0.035]">
              <select
                aria-label={`Choose a ${kind} wallet`}
                value=""
                onChange={(event) => selectAddress(event.target.value)}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none text-transparent outline-none"
              >
                <option value="" className="text-zinc-900">
                  Choose wallet
                </option>
                {accountWallets.length > 0 ? (
                  <optgroup label="Authorized wallets" className="text-zinc-900">
                    {accountWallets.map((wallet) => (
                      <option
                        key={`account:${wallet.id}`}
                        value={wallet.address}
                        className="text-zinc-900"
                      >
                        {wallet.network.toUpperCase()} · {shortAddress(wallet.address)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {addresses.length > 0 ? (
                  <optgroup label="Saved in this browser" className="text-zinc-900">
                    {addresses.map((address) => (
                      <option
                        key={`saved:${address.id}`}
                        value={address.value}
                        className="text-zinc-900"
                      >
                        {address.label} · {shortAddress(address.value)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="pointer-events-none m-auto h-4 w-4 text-zinc-400"
              >
                <path
                  d="m5 7.5 5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                />
              </svg>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={saveAddress}
          disabled={!value.trim()}
          className="shrink-0 rounded-md border border-violet-400/20 bg-violet-400/10 px-2.5 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selectedAddress ? "Rename" : "Save"}
        </button>
        {selectedAddress ? (
          <button
            type="button"
            onClick={removeAddress}
            aria-label={`Remove ${selectedAddress.label} from saved addresses`}
            title="Remove saved address"
            className="shrink-0 rounded-lg border border-white/10 px-3 text-sm text-zinc-500 transition hover:border-red-400/20 hover:text-red-300"
          >
            ×
          </button>
        ) : null}
      </div>
      {parameter.help ? (
        <span className="mt-1 block text-xs leading-4 text-zinc-500">
          {parameter.help}
        </span>
      ) : null}
    </label>
  );
}

type CoinbaseKeyCardProps = {
  title: string;
  description: string;
  capsule: string;
  keyName: string;
  keySecret: string;
  editing: boolean;
  generating: boolean;
  copied: boolean;
  optional?: boolean;
  onKeyNameChange: (value: string) => void;
  onKeySecretChange: (value: string) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onRemove: () => void;
};

function CoinbaseKeyCard({
  title,
  description,
  capsule,
  keyName,
  keySecret,
  editing,
  generating,
  copied,
  optional = false,
  onKeyNameChange,
  onKeySecretChange,
  onGenerate,
  onCopy,
  onEdit,
  onCancel,
  onRemove,
}: CoinbaseKeyCardProps) {
  if (capsule && !editing) {
    return (
      <div className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-emerald-200">{title}</p>
            <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
              Saved
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">
            {description}
          </p>
          <p className="mt-2 truncate font-mono text-[10px] text-zinc-600">
            {capsule.slice(0, 18)}…{capsule.slice(-8)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-red-400/20 bg-red-400/5 px-2.5 py-1.5 text-xs text-red-300 transition hover:bg-red-400/10"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-400/20 bg-blue-400/[0.05] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-blue-100">{title}</p>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">
            {description}
          </p>
        </div>
        {optional ? (
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">
            Optional
          </span>
        ) : null}
      </div>
      <label className="mt-3 block text-xs text-zinc-400">
        API key name
        <input
          value={keyName}
          onChange={(event) => onKeyNameChange(event.target.value)}
          placeholder="organizations/…/apiKeys/…"
          autoComplete="off"
          spellCheck={false}
          className={`${parameterInputClass()} font-mono text-xs`}
        />
      </label>
      <label className="mt-2 block text-xs text-zinc-400">
        EC private key
        <textarea
          value={keySecret}
          onChange={(event) => onKeySecretChange(event.target.value)}
          placeholder="-----BEGIN EC PRIVATE KEY-----"
          rows={2}
          autoComplete="off"
          spellCheck={false}
          className={`${parameterInputClass()} resize-y font-mono text-xs`}
        />
      </label>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[10px] leading-4 text-zinc-600">View-only key</p>
        <div className="flex gap-2">
          {capsule ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="rounded-md bg-blue-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-400 disabled:cursor-wait disabled:opacity-60"
          >
            {generating ? "Checking…" : "Encrypt key"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SheetsBuilder() {
  const defaultSource = sheetSources[0];
  const authorizedWallets = useAuthorizedWallets();
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
  const [shortValueUrls, setShortValueUrls] = useState<Record<string, string>>({});
  const [creatingShortLink, setCreatingShortLink] = useState(false);
  const [coinbaseKeyName, setCoinbaseKeyName] = useState("");
  const [coinbaseKeySecret, setCoinbaseKeySecret] = useState("");
  const [editingCoinbaseKey, setEditingCoinbaseKey] = useState(false);
  const [generatingCoinbaseKey, setGeneratingCoinbaseKey] = useState(false);
  const [coinbaseIntxKeyName, setCoinbaseIntxKeyName] = useState("");
  const [coinbaseIntxKeySecret, setCoinbaseIntxKeySecret] = useState("");
  const [editingCoinbaseIntxKey, setEditingCoinbaseIntxKey] = useState(false);
  const [generatingCoinbaseIntxKey, setGeneratingCoinbaseIntxKey] =
    useState(false);

  useEffect(() => {
    function resetShortLinks() {
      setShortValueUrls({});
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key === "data_hunt_token" ||
        event.key === SHEETS_ACCESS_STORAGE_KEY
      ) {
        resetShortLinks();
      }
    }

    window.addEventListener(AUTH_CHANGED_EVENT, resetShortLinks);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, resetShortLinks);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

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
    ? (rows[0]?.[selectedCell.column] ?? `Column ${selectedCell.column + 1}`)
    : "";
  const selectedCellKey = selectedCell
    ? cellResourceCacheKey(selectedCell.row, selectedCell.column)
    : "";
  const shortValueUrl = selectedCellKey
    ? (shortValueUrls[selectedCellKey] ?? "")
    : "";
  const supportsShortResource = selectedCell
    ? Boolean(
        valueResourceDescriptorForCell(
          selectedCell.row,
          selectedCell.column
        )
      )
    : false;
  const formula =
    selectedCell
      ? formulaForCell(
          selectedCell.row,
          selectedCell.column,
          shortValueUrl
        )
      : "";

  function stableValueUrlForCell(rowIndex: number, columnIndex: number) {
    if (!loadedUrl) return "";
    return buildStableValueUrl({
      apiBaseUrl: API_BASE_URL,
      source: source.id,
      sourceUrl: loadedUrl,
      rows,
      rowIndex,
      columnIndex,
      keyColumn: source.keyColumn,
    });
  }

  function cellResourceCacheKey(rowIndex: number, columnIndex: number) {
    return `${loadedUrl}\n${rowIndex}:${columnIndex}`;
  }

  function valueResourceDescriptorForCell(
    rowIndex: number,
    columnIndex: number
  ) {
    if (!loadedUrl) return null;
    return buildValueResourceDescriptor({
      source: source.id,
      sourceUrl: loadedUrl,
      rows,
      rowIndex,
      columnIndex,
      keyColumn: source.keyColumn,
      credentialParameters: source.parameters
        .filter((parameter) => parameter.kind === "secret")
        .map((parameter) => parameter.key),
    });
  }

  function formulaForCell(
    rowIndex: number,
    columnIndex: number,
    preferredValueUrl = ""
  ) {
    if (!loadedUrl) return "";
    const nextStableUrl =
      preferredValueUrl || stableValueUrlForCell(rowIndex, columnIndex);
    return buildImportFormula({
      url: preferredValueUrl || loadedUrl,
      stableUrl: nextStableUrl,
      rows,
      rowIndex,
      columnIndex,
      separator,
      keyColumn: source.keyColumn,
      stable: Boolean(nextStableUrl),
    });
  }

  async function createShortValueUrl(rowIndex: number, columnIndex: number) {
    const descriptor = valueResourceDescriptorForCell(rowIndex, columnIndex);
    if (!descriptor) return "";

    const loginToken = localStorage.getItem("data_hunt_token") ?? "";
    const loginPayload = jwtPayload(loginToken);
    const expiresAt =
      typeof loginPayload?.exp === "number" ? loginPayload.exp : 0;
    const resourceHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (loginToken && expiresAt > Date.now() / 1000) {
      resourceHeaders.Authorization = `Bearer ${loginToken}`;
    }

    const resourceRequest = fetch(`${API_BASE_URL}/value-resources`, {
      method: "POST",
      headers: resourceHeaders,
      body: JSON.stringify(descriptor.request),
      cache: "no-store",
    });
    const tokenRequest = loginToken
      ? sheetsAccessToken(loginToken)
      : Promise.resolve("");
    const [response, userToken] = await Promise.all([
      resourceRequest,
      tokenRequest,
    ]);
    const content = await response.text();
    if (!response.ok) throw new Error(errorMessage(content));

    const payload = JSON.parse(content) as { id?: unknown };
    if (typeof payload.id !== "string" || !payload.id) {
      throw new Error("The API did not return a short resource ID.");
    }
    return buildShortValueUrl({
      apiBaseUrl: API_BASE_URL,
      resourceId: payload.id,
      credentials: descriptor.credentials,
      userToken,
    });
  }

  async function ensureShortValueUrl(rowIndex: number, columnIndex: number) {
    const key = cellResourceCacheKey(rowIndex, columnIndex);
    const cached = shortValueUrls[key];
    if (cached) return cached;

    const nextUrl = await createShortValueUrl(rowIndex, columnIndex);
    if (nextUrl) {
      setShortValueUrls((current) => ({ ...current, [key]: nextUrl }));
    }
    return nextUrl;
  }

  async function selectCellAndCopyFormula(
    rowIndex: number,
    columnIndex: number
  ) {
    setSelectedCell({ row: rowIndex, column: columnIndex });
    setCreatingShortLink(true);
    setError("");
    try {
      const nextUrl = await ensureShortValueUrl(rowIndex, columnIndex);
      const nextFormula = formulaForCell(rowIndex, columnIndex, nextUrl);
      if (nextFormula) await copyText(nextFormula, "formula");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create a short value link"
      );
    } finally {
      setCreatingShortLink(false);
    }
  }

  async function copySelectedValueUrl() {
    if (!selectedCell) return;
    setCreatingShortLink(true);
    setError("");
    try {
      const nextUrl = await ensureShortValueUrl(
        selectedCell.row,
        selectedCell.column
      );
      const url =
        nextUrl ||
        stableValueUrlForCell(selectedCell.row, selectedCell.column) ||
        loadedUrl;
      if (url) await copyText(url, "url");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create a short value link"
      );
    } finally {
      setCreatingShortLink(false);
    }
  }

  function changeSource(nextSourceId: string) {
    const nextSource =
      sheetSources.find((candidate) => candidate.id === nextSourceId) ??
      defaultSource;
    const nextValues = initialParameterValues(nextSource);
    if (nextSource.id === "coinbase") {
      nextValues.capsule =
        localStorage.getItem(COINBASE_CAPSULE_STORAGE_KEY) ?? "";
      nextValues.intx_capsule =
        localStorage.getItem(COINBASE_INTX_CAPSULE_STORAGE_KEY) ?? "";
    }

    setSourceId(nextSource.id);
    setValues(nextValues);
    setRows([]);
    setLoadedUrl("");
    setSelectedCell(null);
    setShortValueUrls({});
    setError("");
    setCopied(null);
    setCoinbaseKeyName("");
    setCoinbaseKeySecret("");
    setEditingCoinbaseKey(false);
    setCoinbaseIntxKeyName("");
    setCoinbaseIntxKeySecret("");
    setEditingCoinbaseIntxKey(false);
  }

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const missing = source.parameters.find(
      (parameter) => parameter.required && !values[parameter.key]?.trim()
    );
    if (missing) return `Complete the “${missing.label}” field.`;

    if (
      source.requiredAny &&
      !source.requiredAny.some((key) => values[key]?.trim())
    ) {
      const labels = source.requiredAny.map(
        (key) =>
          source.parameters.find((parameter) => parameter.key === key)?.label ?? key
      );
      return `Complete at least one field: ${labels.join(", ")}.`;
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
    setShortValueUrls({});
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
        throw new Error("The API returned an empty table.");
      }

      setRows(nextRows);
      setLoadedUrl(url);
      if (nextRows.length === 1 && nextRows[0]?.length === 1) {
        setSelectedCell({ row: 0, column: 0 });
      }
    } catch (caught) {
      setLoadedUrl("");
      setError(
        caught instanceof Error ? caught.message : "Unable to load the table"
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateCoinbaseCapsule(kind: "main" | "intx") {
    const isIntx = kind === "intx";
    const keyName = (
      isIntx ? coinbaseIntxKeyName : coinbaseKeyName
    ).trim();
    const keySecret = (
      isIntx ? coinbaseIntxKeySecret : coinbaseKeySecret
    ).trim();
    if (!keyName || !keySecret) {
      setError(
        `Enter both the Coinbase ${isIntx ? "Perpetuals" : "Main"} API key name and EC private key.`
      );
      return;
    }

    const setGenerating = isIntx
      ? setGeneratingCoinbaseIntxKey
      : setGeneratingCoinbaseKey;
    setGenerating(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/coinbase/capsule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_name: keyName, key_secret: keySecret }),
        cache: "no-store",
      });
      const content = await response.text();
      if (!response.ok) throw new Error(errorMessage(content));

      const payload = JSON.parse(content) as { capsule?: unknown };
      if (typeof payload.capsule !== "string" || !payload.capsule) {
        throw new Error("The API did not return an encrypted access key.");
      }

      const storageKey = isIntx
        ? COINBASE_INTX_CAPSULE_STORAGE_KEY
        : COINBASE_CAPSULE_STORAGE_KEY;
      const parameterKey = isIntx ? "intx_capsule" : "capsule";
      localStorage.setItem(storageKey, payload.capsule);
      updateValue(parameterKey, payload.capsule);
      if (isIntx) {
        setCoinbaseIntxKeyName("");
        setCoinbaseIntxKeySecret("");
        setEditingCoinbaseIntxKey(false);
      } else {
        setCoinbaseKeyName("");
        setCoinbaseKeySecret("");
        setEditingCoinbaseKey(false);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to generate the encrypted access key"
      );
    } finally {
      setGenerating(false);
    }
  }

  function removeCoinbaseCapsule(kind: "main" | "intx") {
    const isIntx = kind === "intx";
    localStorage.removeItem(
      isIntx
        ? COINBASE_INTX_CAPSULE_STORAGE_KEY
        : COINBASE_CAPSULE_STORAGE_KEY
    );
    updateValue(isIntx ? "intx_capsule" : "capsule", "");
    if (isIntx) {
      setEditingCoinbaseIntxKey(true);
    } else {
      setEditingCoinbaseKey(true);
    }
    setError("");
  }

  async function copyText(text: string, target: CopyTarget) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("The browser blocked clipboard access. Select the text manually.");
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-8 pt-20 text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-20 h-72 w-72 rounded-full bg-violet-600/10 blur-[110px]" />
        <div className="absolute right-[6%] top-56 h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1800px]">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-1.5 inline-flex items-center rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-violet-200">
              Google Sheets helper
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              One value, straight into your spreadsheet
            </h1>
          </div>
          <p className="max-w-2xl text-sm leading-5 text-zinc-500 lg:text-right">
            Choose a source, load the data, and click a cell to copy its Google
            Sheets formula.
          </p>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/30">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium text-white">1. Data source</h2>
              <span className="text-xs text-zinc-500">{sheetSources.length} CSV</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
              <div>
                <label className="block text-sm text-zinc-300">
                  Table
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

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {source.description}
                </p>
              </div>

              <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {source.parameters
                  .filter(
                    (parameter) =>
                      !(
                        source.id === "coinbase" &&
                        (parameter.key === "capsule" ||
                          parameter.key === "intx_capsule")
                      )
                  )
                  .map((parameter) => {
                    const kind = addressKind(parameter);
                    return (
                      <div key={parameter.key} className="min-w-0">
                        {kind ? (
                          <AddressField
                            parameter={parameter}
                            kind={kind}
                            value={values[parameter.key] ?? ""}
                            authorizedWallets={authorizedWallets}
                            onChange={(value) => updateValue(parameter.key, value)}
                            onError={setError}
                          />
                        ) : (
                          <ParameterField
                            parameter={parameter}
                            value={values[parameter.key] ?? ""}
                            onChange={(value) => updateValue(parameter.key, value)}
                          />
                        )}
                      </div>
                    );
                  })}
                {source.id === "coinbase" ? (
                  <div className="grid min-w-0 gap-3 sm:col-span-2 lg:grid-cols-2 xl:col-span-3">
                    <CoinbaseKeyCard
                      title="Main / Coinbase App"
                      description="Wallet balances and the Default portfolio."
                      capsule={values.capsule ?? ""}
                      keyName={coinbaseKeyName}
                      keySecret={coinbaseKeySecret}
                      editing={editingCoinbaseKey}
                      generating={generatingCoinbaseKey}
                      copied={copied === "coinbase-main"}
                      onKeyNameChange={setCoinbaseKeyName}
                      onKeySecretChange={setCoinbaseKeySecret}
                      onGenerate={() => void generateCoinbaseCapsule("main")}
                      onCopy={() =>
                        void copyText(values.capsule ?? "", "coinbase-main")
                      }
                      onEdit={() => setEditingCoinbaseKey(true)}
                      onCancel={() => setEditingCoinbaseKey(false)}
                      onRemove={() => removeCoinbaseCapsule("main")}
                    />
                    <CoinbaseKeyCard
                      title="Perpetuals / INTX"
                      description="INTX cash, margin, PnL, and perpetual positions."
                      capsule={values.intx_capsule ?? ""}
                      keyName={coinbaseIntxKeyName}
                      keySecret={coinbaseIntxKeySecret}
                      editing={editingCoinbaseIntxKey}
                      generating={generatingCoinbaseIntxKey}
                      copied={copied === "coinbase-intx"}
                      optional
                      onKeyNameChange={setCoinbaseIntxKeyName}
                      onKeySecretChange={setCoinbaseIntxKeySecret}
                      onGenerate={() => void generateCoinbaseCapsule("intx")}
                      onCopy={() =>
                        void copyText(
                          values.intx_capsule ?? "",
                          "coinbase-intx"
                        )
                      }
                      onEdit={() => setEditingCoinbaseIntxKey(true)}
                      onCancel={() => setEditingCoinbaseIntxKey(false)}
                      onRemove={() => removeCoinbaseCapsule("intx")}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-[11px] leading-4 text-zinc-600">
                {source.id === "coinbase"
                  ? "Both encrypted access keys stay in this browser. They are added only to the short formula URL and are never stored with the resource."
                  : "Tokens and keys are added only to the formula URL and are never stored with the resource. Do not share sheets containing credentials."}
              </p>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={loadTable}
                  disabled={loading}
                  className="flex min-w-40 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : null}
                  {loading ? "Loading…" : "Load table"}
                </button>
              </div>
            </div>
          </section>

          <div className="min-w-0 space-y-4">
            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
              >
                {error}
              </div>
            ) : null}

            <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
              <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-medium text-white">2. Select a cell</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Click a value to copy the ready-to-use formula.
                  </p>
                </div>
                {rows.length > 0 ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    {creatingShortLink ? (
                      <>
                        <span className="text-violet-300">
                          Creating short link…
                        </span>
                        <span className="text-zinc-700">•</span>
                      </>
                    ) : copied === "formula" ? (
                      <>
                        <span className="text-emerald-300">
                          Formula copied
                        </span>
                        <span className="text-zinc-700">•</span>
                      </>
                    ) : null}
                    <span>{Math.max(0, rows.length - 1)} rows</span>
                    <span className="text-zinc-700">•</span>
                    <span>{rows[0]?.length ?? 0} columns</span>
                  </div>
                ) : null}
              </div>

              {rows.length > 0 ? (
                <div className="max-h-[520px] overflow-auto">
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
                                    void selectCellAndCopyFormula(
                                      rowIndex,
                                      columnIndex
                                    )
                                  }
                                  className={`block min-w-full whitespace-nowrap px-3 py-2 text-left outline-none transition ${
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
                                  {cell || <span className="text-zinc-700">empty</span>}
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
                <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
                  <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 font-mono text-sm text-zinc-500">
                    fx
                  </div>
                  <p className="text-sm text-zinc-400">Your table will appear here</p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-600">
                    Complete the parameters above and click &ldquo;Load table&rdquo;.
                  </p>
                </div>
              )}
            </section>

            {selectedCell && formula ? (
              <section className="rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.09] to-blue-500/[0.04] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-violet-300">
                      Selected
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      {selectedHeader || "Single value"}
                    </h2>
                    <p className="mt-1 max-w-xl break-all font-mono text-sm text-zinc-400">
                      {selectedValue || "empty cell"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(selectedValue, "value")}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  >
                    {copied === "value" ? "Value copied" : "Copy value"}
                  </button>
                </div>

                <div className="mt-4 max-w-sm">
                  <label className="block text-xs text-zinc-400">
                    Argument separator in your Sheets locale
                    <select
                      value={separator}
                      onChange={(event) =>
                        setSeparator(event.target.value as "," | ";")
                      }
                      className={parameterInputClass()}
                    >
                      <option value=";">Semicolon ;</option>
                      <option value=",">Comma ,</option>
                    </select>
                  </label>
                </div>

                <label className="mt-3 block text-xs text-zinc-400">
                  Ready-to-use formula
                  <textarea
                    readOnly
                    value={formula}
                    onFocus={(event) => event.target.select()}
                    rows={3}
                    className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-xs leading-5 text-violet-100 outline-none focus:border-violet-400/50"
                  />
                </label>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() =>
                      selectedCell
                        ? void selectCellAndCopyFormula(
                            selectedCell.row,
                            selectedCell.column
                          )
                        : undefined
                    }
                    disabled={creatingShortLink}
                    className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-violet-100"
                  >
                    {creatingShortLink
                      ? "Creating short link…"
                      : copied === "formula"
                      ? "Formula copied"
                      : "Copy Google Sheets formula"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copySelectedValueUrl()}
                    disabled={creatingShortLink}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  >
                    {copied === "url"
                      ? "URL copied"
                      : supportsShortResource
                        ? "Copy short value URL"
                        : "Copy legacy URL"}
                  </button>
                </div>

                <p className="mt-3 text-xs leading-4 text-zinc-500">
                  {supportsShortResource
                    ? "Signed-in formulas include a revocable, read-only Sheets token and receive a higher request limit. Anonymous formulas remain available with a smaller limit."
                    : "This cell cannot use a stable resource ID, so the compatible legacy URL is used."}
                </p>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
