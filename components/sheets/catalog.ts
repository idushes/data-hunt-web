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
  usesServerCredentials?: boolean;
};

const evmAddress: SheetParameter = {
  key: "address",
  label: "EVM address",
  kind: "text",
  required: true,
  placeholder: "0x…",
};

const solanaWallet: SheetParameter = {
  key: "wallet",
  label: "Solana wallet",
  kind: "text",
  required: true,
  placeholder: "Solana wallet address",
};

export const sheetSources: SheetSource[] = [
  {
    id: "fluid",
    name: "Fluid positions",
    group: "DeFi",
    description: "Deposits, loans, vaults, and Fluid Lite positions for an EVM wallet.",
    path: "/fluid/positions.csv",
    keyColumn: "position_id",
    parameters: [
      evmAddress,
      {
        key: "chain_id",
        label: "Network",
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
    description: "Deposits, loans, APY, and health factor for Aave V3 and V4 positions.",
    path: "/aave/positions.csv",
    keyColumn: "position_id",
    parameters: [
      evmAddress,
      {
        key: "chain_id",
        label: "Network",
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
    id: "morpho",
    name: "Morpho positions",
    group: "DeFi",
    description:
      "Morpho market and vault positions with supply, borrow, collateral, APY, and USD values.",
    path: "/morpho/positions.csv",
    keyColumn: "position_id",
    parameters: [
      evmAddress,
      {
        key: "chain_id",
        label: "Network",
        kind: "select",
        defaultValue: "1",
        options: [
          { label: "Ethereum", value: "1" },
          { label: "Arbitrum", value: "42161" },
          { label: "Base", value: "8453" },
          { label: "HyperEVM", value: "999" },
          { label: "Katana", value: "747474" },
          { label: "Monad", value: "143" },
          { label: "Optimism", value: "10" },
          { label: "Polygon", value: "137" },
          { label: "Tempo", value: "4217" },
          { label: "Unichain", value: "130" },
          { label: "World Chain", value: "480" },
        ],
      },
    ],
  },
  {
    id: "compound",
    name: "Compound III positions",
    group: "DeFi",
    description:
      "Compound III supplies, borrows, collateral, APY, USD values, and liquidation status.",
    path: "/compound/positions.csv",
    keyColumn: "position_id",
    parameters: [
      evmAddress,
      {
        key: "chain_id",
        label: "Network",
        kind: "select",
        defaultValue: "1",
        options: [
          { label: "Ethereum", value: "1" },
          { label: "Arbitrum", value: "42161" },
          { label: "Base", value: "8453" },
        ],
      },
    ],
  },
  {
    id: "euler",
    name: "Euler positions",
    group: "DeFi",
    description:
      "Euler V3 supply, borrow, collateral, USD valuation, and risk data.",
    path: "/euler/positions.csv",
    keyColumn: "position_id",
    parameters: [
      evmAddress,
      {
        key: "chain_id",
        label: "Network",
        kind: "select",
        defaultValue: "1",
        options: [
          { label: "Ethereum", value: "1" },
          { label: "Arbitrum", value: "42161" },
          { label: "Base", value: "8453" },
          { label: "Avalanche", value: "43114" },
          { label: "Berachain", value: "80094" },
          { label: "BNB Chain", value: "56" },
          { label: "Gnosis", value: "100" },
          { label: "HyperEVM", value: "999" },
          { label: "Optimism", value: "10" },
          { label: "Polygon", value: "137" },
          { label: "Sonic", value: "146" },
          { label: "Swell", value: "1923" },
          { label: "TAC", value: "239" },
          { label: "Unichain", value: "130" },
        ],
      },
    ],
  },
  {
    id: "lido",
    name: "Lido staking",
    group: "DeFi",
    description:
      "stETH, wstETH, stETH equivalents, staking APR, and unclaimed withdrawals.",
    path: "/lido/positions.csv",
    keyColumn: "position_id",
    parameters: [evmAddress],
  },
  {
    id: "uniswap",
    name: "Uniswap V3 positions",
    group: "DeFi",
    description:
      "Uniswap V3 NFT positions: current amounts, price range, in-range status, USD value, and claimable fees.",
    path: "/uniswap/positions.csv",
    keyColumn: "position_id",
    parameters: [
      evmAddress,
      {
        key: "chain_id",
        label: "Network",
        kind: "select",
        defaultValue: "1",
        options: [
          { label: "Ethereum", value: "1" },
          { label: "Monad", value: "143" },
        ],
      },
      {
        key: "include_closed",
        label: "Include closed positions",
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
      "Direct USDC and USDT balances for Ethereum and Solana wallets, including zero balances.",
    path: "/stablecoins/balances.csv",
    keyColumn: "balance_id",
    requiredAny: ["address", "wallet"],
    parameters: [
      {
        ...evmAddress,
        label: "Ethereum address",
        required: false,
        help: "You can provide an Ethereum address, a Solana address, or both.",
      },
      {
        ...solanaWallet,
        required: false,
        help: "You can provide an Ethereum address, a Solana address, or both.",
      },
    ],
  },
  {
    id: "stakedao",
    name: "Stake DAO positions",
    group: "DeFi",
    description:
      "Stake DAO strategy vault/gauge and locker positions with amount, USD value, APR, and claimable rewards.",
    path: "/stakedao/positions.csv",
    keyColumn: "position_id",
    parameters: [
      evmAddress,
      {
        key: "chain_id",
        label: "Network",
        kind: "select",
        defaultValue: "1",
        options: [{ label: "Ethereum", value: "1" }],
      },
    ],
  },
  {
    id: "cmc-price",
    name: "CoinMarketCap price",
    group: "Market data",
    description: "One current token price, ready to import into a Sheets cell.",
    path: "/cmc/price.csv",
    requiredAny: ["symbol", "id"],
    parameters: [
      {
        key: "symbol",
        label: "Ticker",
        kind: "text",
        placeholder: "BTC",
        help: "Enter a ticker or CoinMarketCap ID.",
      },
      {
        key: "id",
        label: "CoinMarketCap ID",
        kind: "number",
        placeholder: "1",
      },
      {
        key: "convert",
        label: "Quote currency",
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
    description: "The primary account and subaccounts, or one selected value.",
    path: "/hyperliquid/balance",
    keyColumn: "account",
    parameters: [
      evmAddress,
      {
        key: "account",
        label: "Specific account",
        kind: "text",
        placeholder: "Optional: 0x…",
        help: "When provided, the API returns a single value.",
      },
      {
        key: "field",
        label: "Single-value field",
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
        label: "Sum all accounts into one value",
        kind: "boolean",
        defaultValue: "false",
      },
    ],
  },
  {
    id: "lighter",
    name: "Lighter balance",
    group: "Exchanges",
    description: "Balances for one or more Lighter accounts.",
    path: "/lighter/balance",
    keyColumn: "account_index",
    requiredAny: ["token", "account", "accounts", "address"],
    parameters: [
      {
        key: "token",
        label: "Readonly token",
        kind: "secret",
        placeholder: "Optional",
      },
      {
        key: "account",
        label: "Account index",
        kind: "text",
        placeholder: "Single account index",
        help: "When provided, the API returns a single value.",
      },
      {
        key: "accounts",
        label: "Multiple account indexes",
        kind: "text",
        placeholder: "123,456,789",
      },
      {
        key: "address",
        label: "Linked L1 address",
        kind: "text",
        placeholder: "0x…",
      },
      {
        key: "field",
        label: "Single-value field",
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
    description: "Paradex subaccount balances or one selected metric.",
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
        label: "Specific subaccount",
        kind: "text",
        placeholder: "Optional: 0x…",
        help: "When provided, the API returns a single value.",
      },
      {
        key: "field",
        label: "Single-value field",
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
    description: "Coinbase App and INTX portfolio balances and positions.",
    path: "/coinbase/balance",
    keyColumn: "id",
    usesServerCredentials: true,
    parameters: [
      {
        key: "include_zero",
        label: "Include zero balances",
        kind: "boolean",
        defaultValue: "false",
      },
      {
        key: "include_portfolios",
        label: "Include INTX portfolios",
        kind: "boolean",
        defaultValue: "true",
      },
    ],
  },
  {
    id: "gmtrade-assets",
    name: "GMTrade assets",
    group: "Solana",
    description: "GM and GLV positions for a Solana wallet.",
    path: "/solana/gmtrade.csv",
    keyColumn: "mint",
    parameters: [solanaWallet],
  },
  {
    id: "jupiter-jlp",
    name: "Jupiter JLP",
    group: "Solana",
    description:
      "JLP balance, USD value, price, APR, APY, pool AUM, supply, and realized fees.",
    path: "/jupiter/jlp.csv",
    keyColumn: "position_id",
    parameters: [solanaWallet],
  },
  {
    id: "gmtrade-perps",
    name: "GMTrade perpetuals",
    group: "Solana",
    description: "Open GMTrade perpetual positions.",
    path: "/solana/gmtrade-perps.csv",
    keyColumn: "position_address",
    parameters: [solanaWallet],
  },
  {
    id: "kamino-vaults",
    name: "Kamino kVaults",
    group: "Solana",
    description: "Kamino share-token positions, value, and APY.",
    path: "/solana/kamino.csv",
    keyColumn: "vault_address",
    parameters: [solanaWallet],
  },
  {
    id: "kamino-positions",
    name: "Kamino positions",
    group: "Solana",
    description: "Normalized Kamino Earn and Private Credit positions.",
    path: "/solana/kamino-positions.csv",
    keyColumn: "vault_address",
    parameters: [
      solanaWallet,
      {
        key: "vault",
        label: "Exact vault address",
        kind: "text",
        placeholder: "Optional",
      },
      {
        key: "name",
        label: "Name filter",
        kind: "text",
        placeholder: "Example: USDC",
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
