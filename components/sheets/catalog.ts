export type ParameterKind =
  | "text"
  | "number"
  | "secret"
  | "textarea"
  | "select"
  | "boolean";

export type ParameterOption = {
  label: string;
  value: string;
};

export type SheetParameter = {
  key: string;
  label: string;
  kind: ParameterKind;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  help?: string;
  options?: ParameterOption[];
};

export type SheetSource = {
  id: string;
  name: string;
  group: string;
  description: string;
  path: string;
  parameters: SheetParameter[];
  requiredAny?: string[];
  keyColumn?: string;
  usesDataHuntToken?: boolean;
  usesServerCredentials?: boolean;
};

const dataHuntToken: SheetParameter = {
  key: "token",
  label: "DataHunt token",
  kind: "secret",
  required: true,
  placeholder: "Токен из Account",
  help: "Можно подставить токен текущего аккаунта кнопкой ниже.",
};

const evmAddress: SheetParameter = {
  key: "address",
  label: "EVM-адрес",
  kind: "text",
  required: true,
  placeholder: "0x…",
};

const solanaWallet: SheetParameter = {
  key: "wallet",
  label: "Solana-кошелёк",
  kind: "text",
  required: true,
  placeholder: "Адрес Solana-кошелька",
};

export const sheetSources: SheetSource[] = [
  {
    id: "fluid",
    name: "Fluid positions",
    group: "DeFi",
    description: "Депозиты, займы, vault и Fluid Lite позиции EVM-кошелька.",
    path: "/fluid/positions.csv",
    keyColumn: "position_id",
    parameters: [
      evmAddress,
      {
        key: "chain_id",
        label: "Сеть",
        kind: "select",
        defaultValue: "1",
        options: [
          { label: "Ethereum", value: "1" },
          { label: "Polygon", value: "137" },
          { label: "Base", value: "8453" },
          { label: "Arbitrum", value: "42161" },
          { label: "Plasma", value: "9745" },
        ],
      },
    ],
  },
  {
    id: "aave",
    name: "Aave positions",
    group: "DeFi",
    description: "Депозиты, займы, APY и health factor позиций Aave V3.",
    path: "/aave/positions.csv",
    keyColumn: "position_id",
    parameters: [
      evmAddress,
      {
        key: "chain_id",
        label: "Сеть",
        kind: "select",
        defaultValue: "1",
        options: [
          { label: "Ethereum", value: "1" },
          { label: "Arbitrum", value: "42161" },
          { label: "Avalanche", value: "43114" },
          { label: "Base", value: "8453" },
          { label: "BNB Chain", value: "56" },
          { label: "Celo", value: "42220" },
          { label: "Gnosis", value: "100" },
          { label: "Ink", value: "57073" },
          { label: "Linea", value: "59144" },
          { label: "Mantle", value: "5000" },
          { label: "MegaETH", value: "4326" },
          { label: "Metis", value: "1088" },
          { label: "Monad", value: "143" },
          { label: "Optimism", value: "10" },
          { label: "Plasma", value: "9745" },
          { label: "Polygon", value: "137" },
          { label: "Scroll", value: "534352" },
          { label: "Soneium", value: "1868" },
          { label: "Sonic", value: "146" },
          { label: "X Layer", value: "196" },
          { label: "zkSync", value: "324" },
        ],
      },
    ],
  },
  {
    id: "uniswap",
    name: "Uniswap V3 positions",
    group: "DeFi",
    description:
      "NFT-позиции Uniswap V3: текущие amounts, диапазон цены, in-range и стоимость в USD.",
    path: "/uniswap/positions.csv",
    keyColumn: "position_id",
    parameters: [
      evmAddress,
      {
        key: "chain_id",
        label: "Сеть",
        kind: "select",
        defaultValue: "1",
        options: [{ label: "Ethereum", value: "1" }],
      },
      {
        key: "include_closed",
        label: "Показывать закрытые позиции",
        kind: "boolean",
        defaultValue: "false",
      },
    ],
  },
  {
    id: "stablecoins",
    name: "USDC / USDT balances",
    group: "Wallets",
    description:
      "Прямые балансы USDC и USDT кошельков в Ethereum и Solana, включая нулевые.",
    path: "/stablecoins/balances.csv",
    keyColumn: "balance_id",
    requiredAny: ["address", "wallet"],
    parameters: [
      {
        ...evmAddress,
        label: "Ethereum-адрес",
        required: false,
        help: "Можно указать только Ethereum, только Solana или оба адреса.",
      },
      {
        ...solanaWallet,
        required: false,
        help: "Можно указать только Ethereum, только Solana или оба адреса.",
      },
    ],
  },
  {
    id: "debt",
    name: "DataHunt debt",
    group: "DataHunt account",
    description: "Займы и обеспечение по всем адресам аккаунта DataHunt.",
    path: "/debt",
    keyColumn: "id",
    usesDataHuntToken: true,
    parameters: [dataHuntToken],
  },
  {
    id: "stability",
    name: "DataHunt stability",
    group: "DataHunt account",
    description: "Стоимость и состав одиночных DeFi-позиций аккаунта.",
    path: "/stability",
    keyColumn: "id",
    usesDataHuntToken: true,
    parameters: [dataHuntToken],
  },
  {
    id: "pool",
    name: "DataHunt liquidity pools",
    group: "DataHunt account",
    description: "LP-позиции, токены, награды и стоимость в USD.",
    path: "/pool",
    keyColumn: "id",
    usesDataHuntToken: true,
    parameters: [dataHuntToken],
  },
  {
    id: "wallet",
    name: "DataHunt wallet tokens",
    group: "DataHunt account",
    description: "Токены кошельков аккаунта, цена и стоимость в USD.",
    path: "/wallet",
    keyColumn: "id",
    usesDataHuntToken: true,
    parameters: [
      dataHuntToken,
      {
        key: "min_usd_value",
        label: "Минимальная стоимость, USD",
        kind: "number",
        defaultValue: "0",
        placeholder: "0",
      },
    ],
  },
  {
    id: "cmc-price",
    name: "CoinMarketCap price",
    group: "Market data",
    description: "Одна актуальная цена токена — готовая ячейка для Sheets.",
    path: "/cmc/price.csv",
    requiredAny: ["symbol", "id"],
    parameters: [
      {
        key: "symbol",
        label: "Тикер",
        kind: "text",
        placeholder: "BTC",
        help: "Укажите тикер или CoinMarketCap ID.",
      },
      {
        key: "id",
        label: "CoinMarketCap ID",
        kind: "number",
        placeholder: "1",
      },
      {
        key: "convert",
        label: "Валюта цены",
        kind: "text",
        defaultValue: "USD",
        placeholder: "USD",
      },
    ],
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid balance",
    group: "Exchanges",
    description: "Основной аккаунт и subaccounts либо одно выбранное значение.",
    path: "/hyperliquid/balance",
    keyColumn: "account",
    parameters: [
      evmAddress,
      {
        key: "account",
        label: "Конкретный account",
        kind: "text",
        placeholder: "Необязательно: 0x…",
        help: "Если заполнить, API сразу вернёт одну цифру.",
      },
      {
        key: "field",
        label: "Поле для одной цифры",
        kind: "select",
        defaultValue: "account_value",
        options: [
          { label: "Account value", value: "account_value" },
          { label: "Withdrawable", value: "withdrawable" },
          { label: "Spot USDC", value: "spot_usdc" },
          { label: "Total equity", value: "total_equity" },
        ],
      },
      {
        key: "aggregate",
        label: "Суммировать все аккаунты в одну цифру",
        kind: "boolean",
        defaultValue: "false",
      },
    ],
  },
  {
    id: "lighter",
    name: "Lighter balance",
    group: "Exchanges",
    description: "Балансы одного или нескольких Lighter-аккаунтов.",
    path: "/lighter/balance",
    keyColumn: "account_index",
    requiredAny: ["token", "account", "accounts", "address"],
    parameters: [
      {
        key: "token",
        label: "Readonly token",
        kind: "secret",
        placeholder: "Необязательно",
      },
      {
        key: "account",
        label: "Account index",
        kind: "text",
        placeholder: "Один account index",
        help: "Если заполнить, API сразу вернёт одну цифру.",
      },
      {
        key: "accounts",
        label: "Несколько account indexes",
        kind: "text",
        placeholder: "123,456,789",
      },
      {
        key: "address",
        label: "Связанный L1-адрес",
        kind: "text",
        placeholder: "0x…",
      },
      {
        key: "field",
        label: "Поле для одной цифры",
        kind: "select",
        defaultValue: "total_asset_value",
        options: [
          { label: "Total asset value", value: "total_asset_value" },
          { label: "Cross asset value", value: "cross_asset_value" },
          { label: "Collateral", value: "collateral" },
          { label: "Available balance", value: "available_balance" },
        ],
      },
    ],
  },
  {
    id: "paradex",
    name: "Paradex balance",
    group: "Exchanges",
    description: "Балансы Paradex subaccounts или одна выбранная метрика.",
    path: "/paradex/balance",
    keyColumn: "account",
    parameters: [
      {
        key: "token",
        label: "Paradex token",
        kind: "secret",
        required: true,
        placeholder: "Bearer token",
      },
      {
        key: "account",
        label: "Конкретный subaccount",
        kind: "text",
        placeholder: "Необязательно: 0x…",
        help: "Если заполнить, API сразу вернёт одну цифру.",
      },
      {
        key: "field",
        label: "Поле для одной цифры",
        kind: "select",
        defaultValue: "account_value",
        options: [
          { label: "Account value", value: "account_value" },
          { label: "Total collateral", value: "total_collateral" },
          { label: "Free collateral", value: "free_collateral" },
          {
            label: "Initial margin requirement",
            value: "initial_margin_requirement",
          },
          {
            label: "Maintenance margin requirement",
            value: "maintenance_margin_requirement",
          },
          { label: "Margin cushion", value: "margin_cushion" },
        ],
      },
    ],
  },
  {
    id: "coinbase",
    name: "Coinbase balances",
    group: "Exchanges",
    description: "Coinbase App и INTX portfolio balances/positions.",
    path: "/coinbase/balance",
    keyColumn: "id",
    usesServerCredentials: true,
    parameters: [
      {
        key: "include_zero",
        label: "Показывать нулевые балансы",
        kind: "boolean",
        defaultValue: "false",
      },
      {
        key: "include_portfolios",
        label: "Добавить INTX portfolios",
        kind: "boolean",
        defaultValue: "true",
      },
    ],
  },
  {
    id: "gmtrade-assets",
    name: "GMTrade assets",
    group: "Solana",
    description: "GM и GLV позиции Solana-кошелька.",
    path: "/solana/gmtrade.csv",
    keyColumn: "mint",
    parameters: [solanaWallet],
  },
  {
    id: "gmtrade-perps",
    name: "GMTrade perpetuals",
    group: "Solana",
    description: "Открытые GMTrade perpetual-позиции.",
    path: "/solana/gmtrade-perps.csv",
    keyColumn: "position_address",
    parameters: [solanaWallet],
  },
  {
    id: "kamino-vaults",
    name: "Kamino kVaults",
    group: "Solana",
    description: "Kamino share-token позиции, стоимость и APY.",
    path: "/solana/kamino.csv",
    keyColumn: "vault_address",
    parameters: [solanaWallet],
  },
  {
    id: "kamino-positions",
    name: "Kamino positions",
    group: "Solana",
    description: "Нормализованные Earn и Private Credit позиции Kamino.",
    path: "/solana/kamino-positions.csv",
    keyColumn: "vault_address",
    parameters: [
      solanaWallet,
      {
        key: "vault",
        label: "Точный vault address",
        kind: "text",
        placeholder: "Необязательно",
      },
      {
        key: "name",
        label: "Фильтр по названию",
        kind: "text",
        placeholder: "Например USDC",
      },
    ],
  },
];

export function initialParameterValues(source: SheetSource) {
  return Object.fromEntries(
    source.parameters.map((parameter) => [
      parameter.key,
      parameter.defaultValue ?? "",
    ])
  );
}
