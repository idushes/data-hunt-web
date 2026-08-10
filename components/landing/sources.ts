import { sheetSources } from "../sheets/catalog";

type SourceVisual = {
  mark: string;
  tone: string;
};

const visuals: Partial<Record<string, SourceVisual>> = {
  fluid: { mark: "FL", tone: "from-blue-500 to-cyan-300" },
  aave: { mark: "A", tone: "from-violet-500 to-fuchsia-400" },
  morpho: { mark: "M", tone: "from-sky-400 to-blue-600" },
  compound: { mark: "C³", tone: "from-emerald-400 to-green-600" },
  euler: { mark: "E", tone: "from-orange-400 to-red-500" },
  lido: { mark: "L", tone: "from-sky-300 to-blue-500" },
  gmx: { mark: "G", tone: "from-cyan-400 to-indigo-500" },
  uniswap: { mark: "U", tone: "from-pink-500 to-rose-400" },
  stablecoins: { mark: "$", tone: "from-blue-500 to-emerald-400" },
  stakedao: { mark: "SD", tone: "from-red-500 to-orange-400" },
  "cmc-price": { mark: "CMC", tone: "from-indigo-500 to-blue-300" },
  hyperliquid: { mark: "HL", tone: "from-cyan-400 to-emerald-300" },
  lighter: { mark: "L", tone: "from-zinc-400 to-white" },
  paradex: { mark: "P", tone: "from-orange-500 to-violet-500" },
  coinbase: { mark: "C", tone: "from-blue-600 to-blue-400" },
  "gmtrade-assets": { mark: "GM", tone: "from-emerald-500 to-lime-300" },
  "jupiter-jlp": { mark: "J", tone: "from-lime-300 to-cyan-400" },
  "gmtrade-perps": { mark: "GM", tone: "from-green-500 to-cyan-400" },
  "kamino-vaults": { mark: "K", tone: "from-orange-500 to-amber-300" },
  "kamino-positions": { mark: "K", tone: "from-amber-300 to-orange-600" },
};

const fallbackVisual: SourceVisual = {
  mark: "DH",
  tone: "from-violet-500 to-blue-400",
};

export const landingSources = sheetSources.map((source) => ({
  id: source.id,
  name: source.name,
  group: source.group,
  ...(visuals[source.id] ?? fallbackVisual),
}));

export const landingSourceGroups = Array.from(
  new Set(sheetSources.map((source) => source.group))
);
