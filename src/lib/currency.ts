// Currency display, driven by the catalogue the backend serves (GET /currencies
// via lib/currencies.ts).
//
// These helpers were a symbol map, a name map and a stablecoin list held here,
// which meant a new currency needed a frontend edit and an app-store release
// before a user in that currency saw anything sensible. THERE IS NO CURRENCY
// LIST IN THIS FILE ANY MORE. Adding one is a backend change.
//
// They stay synchronous because they are called during render from a dozen
// screens; the catalogue is hydrated from storage before the first paint and
// refreshed from the API behind it.

export interface CurrencyMeta {
  code: string;
  name: string;
  /** Null for coins, which render as "<amount> CODE" rather than a symbol. */
  symbol: string | null;
  decimals: number;
  kind: "fiat" | "stablecoin";
  /** What one unit is worth one of: 'USD' for USDT/USDC, 'NGN' for cNGN. */
  peggedTo: string | null;
  arrival: "virtual_account" | "charge" | "onchain" | "receiving";
}

/**
 * What the app knows before the backend answers.
 *
 * This is a FALLBACK, not the source of truth — the fetched catalogue replaces
 * it wholesale. Adding a currency is still a backend-only change: a new one
 * arrives over the wire and needs nothing here.
 *
 * It exists because the alternative was worse. With nothing to fall back on,
 * the first render after an update had no catalogue at all: the balance could
 * not be priced and showed a dash, the currency picker had no options, and
 * Receive could not tell which rail a currency used and offered the wrong one.
 * A screen that is briefly wrong is worse than one that is briefly stale.
 */
const SEED: CurrencyMeta[] = [
  { code: "NGN", name: "Naira", symbol: "₦", decimals: 2, kind: "fiat", peggedTo: null, arrival: "virtual_account" },
  { code: "GHS", name: "Cedi", symbol: "₵", decimals: 2, kind: "fiat", peggedTo: null, arrival: "virtual_account" },
  { code: "KES", name: "Shilling", symbol: "KSh ", decimals: 2, kind: "fiat", peggedTo: null, arrival: "virtual_account" },
  { code: "TZS", name: "Shilling", symbol: "TSh ", decimals: 2, kind: "fiat", peggedTo: null, arrival: "virtual_account" },
  { code: "ZAR", name: "Rand", symbol: "R", decimals: 2, kind: "fiat", peggedTo: null, arrival: "charge" },
  { code: "UGX", name: "Shilling", symbol: "USh ", decimals: 2, kind: "fiat", peggedTo: null, arrival: "charge" },
  { code: "USDT", name: "USDT", symbol: null, decimals: 6, kind: "stablecoin", peggedTo: "USD", arrival: "onchain" },
  { code: "USDC", name: "USDC", symbol: null, decimals: 6, kind: "stablecoin", peggedTo: "USD", arrival: "onchain" },
  { code: "CNGN", name: "cNGN", symbol: null, decimals: 6, kind: "stablecoin", peggedTo: "NGN", arrival: "onchain" },
];

let CATALOGUE = new Map<string, CurrencyMeta>(
  SEED.map((c) => [c.code, c]),
);

export const setCurrencyCatalogue = (list: CurrencyMeta[]): void => {
  CATALOGUE = new Map(list.map((c) => [c.code.toUpperCase(), c]));
};

export const currencyMeta = (currency: string): CurrencyMeta | undefined =>
  CATALOGUE.get(currency?.toUpperCase?.() ?? "");

/**
 * The catalogue entry for a code, or a minimal stand-in.
 *
 * For the moment before the catalogue loads, and for a code the backend offers
 * somewhere but has not catalogued: rendering it as its own code is right, and
 * better than hiding an option the user is entitled to pick.
 */
export const metaOrCode = (currency: string): CurrencyMeta =>
  currencyMeta(currency) ?? {
    code: currency,
    name: currency,
    symbol: null,
    decimals: 6,
    kind: "stablecoin",
    peggedTo: null,
    arrival: "onchain",
  };

/** Every currency the backend knows, in the order it sent them. */
export const allCurrencies = (): CurrencyMeta[] => [...CATALOGUE.values()];

export const currencyName = (currency: string): string =>
  currencyMeta(currency)?.name ?? currency;

/**
 * True for a stablecoin rather than a local fiat.
 *
 * An unknown currency reads as fiat — before the catalogue loads that is the
 * safer guess, since it only affects which balance leads the list, and a fiat
 * is what almost every user holds most of.
 */
export const isStablecoin = (currency: string): boolean =>
  currencyMeta(currency)?.kind === "stablecoin";

export const formatMoney = (amount: number, currency: string): string => {
  const meta = currencyMeta(currency);
  // No symbol is how the catalogue says "render me as a code" — that is how a
  // coin is told from a fiat now, not a list in the app.
  if (!meta || meta.symbol === null) {
    return `${amount.toLocaleString("en-US", {
      maximumFractionDigits: meta?.decimals ?? 6,
    })} ${meta?.name ?? currency}`;
  }
  return `${meta.symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  })}`;
};
