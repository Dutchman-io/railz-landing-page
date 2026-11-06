import type { ReviewRow } from "@/components/common/ReviewSheet";
import { isChargedFee } from "@/lib/fees";
import type { GlobalSendQuote } from "@/lib/globalSend";

/**
 * The fixed recipient fields of a payout (mobile kept each in its own
 * useState). Held together so the form clears in one go after a send.
 */
export interface PayoutFields {
  usPaymentRail: "ACH" | "WIRE";
  beneficiaryName: string;
  routingNumber: string;
  /** China: the bank the card or account belongs to. */
  recipientBank: string;
  accountNumber: string;
  sortCode: string;
  transitNumber: string;
  institutionNumber: string;
  /** The recipient's own address, for corridors whose partner registers the
   * account with one (corridor.addressFields). */
  street: string;
  city: string;
  state: string;
  postal: string;
}

export const EMPTY_PAYOUT_FIELDS: PayoutFields = {
  usPaymentRail: "ACH",
  beneficiaryName: "",
  routingNumber: "",
  recipientBank: "",
  accountNumber: "",
  sortCode: "",
  transitNumber: "",
  institutionNumber: "",
  street: "",
  city: "",
  state: "",
  postal: "",
};

/** Countries with a dedicated, hand-built recipient form. */
export const FIXED_FORM_COUNTRIES = ["US", "GB", "CA", "CN"];

/**
 * The label/placeholder for the one generic "account number" field every
 * corridor without its own dedicated form (US/GB/CA/CN) falls back to. Keyed
 * by currency, not by country: SEPA/CLABE/Pix are standard rail identifiers,
 * the same closed set regardless of which country sends to them.
 */
export const accountNumberLabel = (currency?: string): string => {
  switch (currency) {
    case "EUR":
      return "IBAN";
    case "MXN":
      return "CLABE";
    case "BRL":
      return "Pix Key";
    default:
      return "Account Number";
  }
};

export const accountNumberPlaceholder = (currency?: string): string => {
  switch (currency) {
    case "EUR":
      return "e.g. DE89 3704 0044 0532 0130 00";
    case "MXN":
      return "18-digit CLABE";
    case "BRL":
      return "Pix key: CPF, phone, email, or random key";
    default:
      return "Beneficiary's account number";
  }
};

/**
 * Every fee in a cross-border quote, each on its own line and only when
 * charged. None is folded into another figure:
 *  - ZemFi fee: our own, in the source currency, out of what is sent.
 *  - Transfer fee: the cross-border transfer fee, in the source currency,
 *    also out of what is sent. "Sent as" is the server's assetAmount, which
 *    is already sourceAmount less this and the ZemFi fee, converted.
 *  - Withdrawal fee: on a send that converts nothing (a domestic payout is a
 *    withdrawal to the beneficiary), whatever else comes out of the amount
 *    before it is sent -- sourceAmount - ZemFi fee - transfer fee - what is
 *    sent. A cross-border send paid from a stablecoin balance also converts
 *    nothing, and that difference is 0 there, so no line appears.
 *  - Delivery fee: the delivering partner's own, where it itemises one;
 *    already off the "Recipient gets" estimate.
 */
export const globalFeeRows = (
  quote: GlobalSendQuote,
  money: (value: number, currency: string) => string,
): ReviewRow[] => {
  const rows: ReviewRow[] = [];
  const transferFee = quote.transferFee ?? 0;
  if (isChargedFee(quote.partnerFee)) {
    rows.push(["ZemFi fee", money(quote.partnerFee, quote.sourceCurrency)]);
  }
  if (isChargedFee(transferFee)) {
    rows.push(["Transfer fee", money(transferFee, quote.sourceCurrency)]);
  }
  // Converting the sender's money to the stablecoin: the rate they get, and
  // what it costs against the market -- a cost that otherwise sits unseen
  // inside the rate.
  const margin = quote.converted ? (quote.conversionMargin ?? 0) : 0;
  if (quote.converted) {
    rows.push(["Exchange rate", `1 ${quote.asset} = ${money(quote.rate, quote.sourceCurrency)}`]);
  }
  if (isChargedFee(margin)) {
    const bps = quote.conversionMarginBps ?? 0;
    rows.push([
      bps > 0 ? `Conversion (${(bps / 100).toFixed(2)}%)` : "Conversion",
      money(margin, quote.sourceCurrency),
    ]);
  }
  let withdrawalFee = 0;
  if (!quote.converted && quote.asset === quote.sourceCurrency) {
    withdrawalFee = Number((quote.sourceAmount - quote.partnerFee - transferFee - quote.assetAmount).toFixed(6));
    if (isChargedFee(withdrawalFee)) {
      rows.push(["Withdrawal fee", money(withdrawalFee, quote.sourceCurrency)]);
    }
  }
  // Everything this send costs in the sender's own currency, on one line --
  // or a plain statement that it costs nothing, rather than silence.
  const total = Number(
    (quote.partnerFee + transferFee + margin + (isChargedFee(withdrawalFee) ? withdrawalFee : 0)).toFixed(6),
  );
  rows.push(["Total fees", isChargedFee(total) ? money(total, quote.sourceCurrency) : "None"]);
  const delivery = quote.providerFee;
  if (delivery && isChargedFee(delivery.amount)) {
    rows.push(["Delivery fee", money(delivery.amount, delivery.currency)]);
  }
  return rows;
};
