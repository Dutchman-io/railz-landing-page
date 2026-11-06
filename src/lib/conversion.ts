// Conversion math for the buy/sell screen.
//
// `rate` is the quoted rate the server hands us: the market price with our
// spread applied server-side. The spread is part of the price, not a fee, and
// is never returned on its own (it is internal pricing). Applying it again
// here would charge the user twice.
//
// Fees are never folded into the rate or into any other figure. Each one is
// shown as its own line before the user confirms:
//
//  - Exchange fee (sells only): the exchange's fixed execution fee, a flat
//    amount of the asset being sold, converted at the same rate as the rest.
//  - ZemFi fee (buy or sell, may be 0): our own fee, in the fiat. It is only
//    known once a quote is locked, so the pre-quote preview cannot include it;
//    the review shows the server's figure.
//
// Nothing goes on chain (a conversion is a ledger move between two balances),
// so there is no gas; the withdrawal fee is charged separately, when fiat
// actually leaves to a bank, and shown on that review.
//
// The arithmetic matches the server's quote exactly:
//   sell: destination = (amount - exchangeFee) * rate - zemfiFee
//   buy:  destination = (amount - zemfiFee) / rate
// The preview below computes it with zemfiFee = 0 (unknown until the quote);
// the review always shows the locked quote's own numbers.
//
// Amounts are plain numbers; coins are rounded to 6 dp and fiat to 2 dp so the
// figures stay stable across rate ticks.

import type { Quote } from "@/types/api";

export interface QuoteParameters {
  /** Local fiat per unit of the asset, spread applied, from the server. */
  rate: number;
  /** The exchange's fixed execution fee, in units of the asset. Sells only. */
  exchangeFeeAsset: number;
}

const round = (value: number, dp: number): number => {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
};

const positive = (n: number): boolean => Number.isFinite(n) && n > 0;

/** The sell exchange fee in units of the asset, coerced to 0 so a partial
 * payload can never surface NaN. */
export const sellExchangeFeeAsset = (params: QuoteParameters): number => {
  const fee = params.exchangeFeeAsset || 0;
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
};

/** The sell exchange fee in fiat: the flat amount of the asset, converted at
 * the same rate the rest of it converts at. */
export const sellExchangeFeeFiat = (params: QuoteParameters): number => {
  const fee = sellExchangeFeeAsset(params) * params.rate;
  return Number.isFinite(fee) ? round(fee, 2) : 0;
};

/** Fiat in -> asset out, before any ZemFi fee (known only once quoted). Buys
 * carry no exchange fee. */
export function calcBuy(fiatIn: number, params: QuoteParameters): number {
  if (!positive(fiatIn) || !positive(params.rate)) return 0;
  return round(fiatIn / params.rate, 6);
}

/** Asset in -> fiat out: (amount - exchangeFee) * rate, before any ZemFi fee
 * (known only once quoted). */
export function calcSell(assetIn: number, params: QuoteParameters): number {
  if (!positive(assetIn) || !positive(params.rate)) return 0;
  const net = (assetIn - sellExchangeFeeAsset(params)) * params.rate;
  return net > 0 ? round(net, 2) : 0;
}

/**
 * Reverse of calcSell: given the fiat the user wants to RECEIVE, how much of
 * the asset must they sell?
 *
 *   net = (asset - fee) * rate   =>   asset = net / rate + fee
 */
export function assetForFiat(
  targetFiat: number,
  params: QuoteParameters,
): number {
  if (!positive(targetFiat) || !positive(params.rate)) return 0;
  return round(targetFiat / params.rate + sellExchangeFeeAsset(params), 6);
}

/** A locked quote's fees, each as its own figure for the review. */
export interface QuoteFees {
  /** Sell exchange fee in units of the asset; 0 on a buy. */
  exchangeFeeAsset: number;
  /** The same fee in the fiat, as the server quoted it; 0 on a buy. */
  exchangeFeeFiat: number;
  /** ZemFi's own fee, in the fiat; 0 when none applies. */
  zemfiFee: number;
}

const nonNegative = (n: number | undefined): number =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;

/**
 * Read the fees out of a locked quote. The server reports the exchange fee in
 * the fiat (`exchangeFee`, converted at `rate`); dividing by `rate` gives back
 * the flat amount of the asset it was priced from.
 */
export function quoteFees(quote: Quote): QuoteFees {
  const exchangeFeeFiat = nonNegative(quote.exchangeFee);
  return {
    exchangeFeeAsset:
      exchangeFeeFiat > 0 && positive(quote.rate)
        ? round(exchangeFeeFiat / quote.rate, 6)
        : 0,
    exchangeFeeFiat,
    zemfiFee: nonNegative(quote.partnerFee),
  };
}
