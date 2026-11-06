// The fee-transparency promise, in one place so every money screen says it
// the same way.
//
// The promise is only true because every review screen itemises every fee
// the server charges on its own line, before the user confirms: buy/sell
// (exchange fee, ZemFi fee), crypto send (network fee, ZemFi fee), withdraw
// to bank (withdrawal fee) and cross-border send (ZemFi fee, transfer fee,
// withdrawal fee, delivery fee). The spread is part of the quoted rate -- the price -- and is
// not a fee. A screen that folds a fee into some other figure must not show
// this note.

/** One-line note under the fee lines of every money review/confirm screen. */
export const NO_HIDDEN_FEES_NOTE =
  "No hidden fees — every fee is shown above before you confirm.";

/** Short form, for headers where a full sentence would be clutter. */
export const NO_HIDDEN_FEES_SHORT = "No hidden fees";

/** True when a fee is worth its own line: a real, positive amount. */
export const isChargedFee = (fee: number | null | undefined): fee is number =>
  typeof fee === "number" && Number.isFinite(fee) && fee > 0;
