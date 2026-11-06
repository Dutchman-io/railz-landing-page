// Display names and brand colours for the currencies and tokens the app shows.
// Only presentation: which assets exist is the server's list, and an asset
// missing here still renders, with its code as its name and a neutral colour.

interface AssetMeta {
  name: string;
  /** The asset's own brand colour, used for its icon. */
  color: string;
}

const META: Record<string, AssetMeta> = {
  NGN: { name: "Nigerian Naira", color: "#008751" },
  GHS: { name: "Ghanaian Cedi", color: "#CE1126" },
  KES: { name: "Kenyan Shilling", color: "#006600" },
  TZS: { name: "Tanzanian Shilling", color: "#1EB53A" },
  ZAR: { name: "South African Rand", color: "#007749" },
  USDT: { name: "Tether", color: "#26A17B" },
  USDC: { name: "USD Coin", color: "#2775CA" },
  CNGN: { name: "Compliant Naira", color: "#008751" },
  BTC: { name: "Bitcoin", color: "#F7931A" },
  ETH: { name: "Ethereum", color: "#627EEA" },
  SOL: { name: "Solana", color: "#9945FF" },
  BNB: { name: "BNB", color: "#F0B90B" },
  TRX: { name: "TRON", color: "#EB0029" },
  LINK: { name: "Chainlink", color: "#2A5ADA" },
  SHIB: { name: "Shiba Inu", color: "#F2A515" },
  AAVE: { name: "Aave", color: "#B6509E" },
  POL: { name: "Polygon", color: "#8247E5" },
  LTC: { name: "Litecoin", color: "#345D9D" },
  BCH: { name: "Bitcoin Cash", color: "#0AC18E" },
  ADA: { name: "Cardano", color: "#0033AD" },
  SUI: { name: "Sui", color: "#4DA2FF" },
  XRP: { name: "XRP", color: "#23292F" },
  XLM: { name: "Stellar", color: "#7D00FF" },
  TON: { name: "Toncoin", color: "#0098EA" },
};

const NETWORK_NAMES: Record<string, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  solana: "Solana",
  bsc: "BNB Smart Chain",
  tron: "TRON",
  polygon: "Polygon",
  litecoin: "Litecoin",
  "bitcoin-cash": "Bitcoin Cash",
  cardano: "Cardano",
  sui: "Sui",
  "xrp-ledger": "XRP Ledger",
  stellar: "Stellar",
  ton: "TON",
};

export const assetName = (code: string): string =>
  META[code.toUpperCase()]?.name ?? code.toUpperCase();

export const assetColor = (code: string): string =>
  META[code.toUpperCase()]?.color ?? "#64748B";

export const networkName = (network: string): string =>
  NETWORK_NAMES[network.toLowerCase()] ?? network;
