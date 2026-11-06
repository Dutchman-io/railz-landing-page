import { currencyMeta } from "./currency";
import type { RateSnapshot, WalletBalance } from "@/types/api";

/**
 * What everything is worth, expressed in one currency.
 *
 * The rate endpoint prices exactly one pair — USDT against the caller's own
 * fiat — so everything else is priced through a peg the catalogue states:
 * USDT and USDC are dollars, cNGN is naira. That is why the peg is data. A
 * currency added tomorrow is valued correctly here without this file changing,
 * as long as its entry says what it is worth one of.
 *
 * USD is the pivot because that is what the pegs are expressed in.
 */

export interface PortfolioTotal {
  /** The total, in `currency`. Null when nothing could be priced. */
  amount: number | null;
  /**
   * Holdings that could not be priced, by code. A total that quietly omits a
   * balance is worse than one that says it is incomplete — the user would see
   * a number lower than their money and have no way to know why.
   */
  unpriced: string[];
}

/** Mid-market: neither a buy nor a sell is happening, we are just valuing. */
const midRate = (rate: RateSnapshot | undefined): number | null => {
  if (!rate) return null;
  const mid = (rate.buyRate + rate.sellRate) / 2;
  return mid > 0 ? mid : null;
};

/** One unit of `code`, in USD. Null when it cannot be priced. */
const unitInUsd = (
  code: string,
  rate: RateSnapshot | undefined,
): number | null => {
  const meta = currencyMeta(code);
  if (!meta) return null;

  // Pegged: worth one unit of whatever it pegs to.
  if (meta.peggedTo === "USD") return 1;
  if (meta.peggedTo) return unitInUsd(meta.peggedTo, rate);

  // Unpegged, and the one pair we can actually price.
  if (rate && code.toUpperCase() === rate.fiatCurrency.toUpperCase()) {
    const mid = midRate(rate);
    return mid ? 1 / mid : null;
  }

  // An unpegged currency we hold no rate for. Saying so beats guessing.
  return null;
};

export function totalIn(
  currency: string,
  balances: WalletBalance[] | undefined,
  rate: RateSnapshot | undefined,
): PortfolioTotal {
  const target = unitInUsd(currency, rate);
  if (!balances || balances.length === 0 || target === null) {
    return { amount: null, unpriced: [] };
  }

  let usd = 0;
  const unpriced: string[] = [];
  for (const b of balances) {
    const amount = Number(b.balance);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const unit = unitInUsd(b.currency, rate);
    if (unit === null) {
      unpriced.push(b.currency);
      continue;
    }
    usd += amount * unit;
  }

  return { amount: usd / target, unpriced };
}
