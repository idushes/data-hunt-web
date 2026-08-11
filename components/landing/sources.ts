import { sheetSources } from "../sheets/catalog";

type SourceVisual = {
  logos: readonly string[];
  logoClassName?: string;
};

type LandingGroup = {
  name: string;
  detail: string;
  members: readonly string[];
};

const visuals: Partial<Record<string, SourceVisual>> = {
  fluid: { logos: ["/logos/fluid.webp"] },
  aave: { logos: ["/logos/aave.webp"] },
  morpho: { logos: ["/logos/morpho.webp"] },
  compound: { logos: ["/logos/compound.webp"] },
  euler: { logos: ["/logos/euler.webp"] },
  lido: { logos: ["/logos/lido.webp"] },
  gmx: { logos: ["/logos/gmx.webp"] },
  polymarket: {
    logos: ["/logos/polymarket.png"],
    logoClassName: "bg-white p-2 object-contain",
  },
  uniswap: { logos: ["/logos/uniswap.webp"] },
  stablecoins: { logos: ["/logos/usdc.png", "/logos/usdt.png"] },
  stakedao: { logos: ["/logos/stakedao.webp"] },
  "cmc-price": { logos: ["/logos/coinmarketcap.png"] },
  hyperliquid: { logos: ["/logos/hyperliquid.webp"] },
  lighter: { logos: ["/logos/lighter.webp"] },
  paradex: { logos: ["/logos/paradex.webp"] },
  coinbase: { logos: ["/logos/coinbase.webp"] },
  "gmtrade-assets": { logos: ["/logos/gmtrade.webp"] },
  "jupiter-jlp": { logos: ["/logos/jupiter.webp"] },
  "kamino-vaults": { logos: ["/logos/kamino.webp"] },
};

const groups: Partial<Record<string, LandingGroup>> = {
  "gmtrade-assets": {
    name: "GMTrade",
    detail: "Assets · Perpetuals",
    members: ["gmtrade-perps"],
  },
  "kamino-vaults": {
    name: "Kamino",
    detail: "kVaults · Positions",
    members: ["kamino-positions"],
  },
};

const groupedMemberIds = new Set(
  Object.values(groups).flatMap((group) => group?.members ?? []),
);

const fallbackVisual: SourceVisual = {
  logos: ["/favicon_io/datahunt-mark.svg"],
};

export const landingSources = sheetSources
  .filter((source) => !groupedMemberIds.has(source.id))
  .map((source) => {
    const combined = groups[source.id];
    return {
      id: source.id,
      name: combined?.name ?? source.name,
      group: source.group,
      detail: combined?.detail,
      sourceIds: [source.id, ...(combined?.members ?? [])],
      ...(visuals[source.id] ?? fallbackVisual),
    };
  });

export const landingSourceGroups = Array.from(
  new Set(sheetSources.map((source) => source.group))
);
