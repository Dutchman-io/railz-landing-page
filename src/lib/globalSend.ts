import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { currencyMeta, formatMoney } from "./currency";
import { api } from "./api";
import { PAYMENT_PURPOSES, type PaymentPurpose } from "@/types/api";

/**
 * Cross-border payout. The sender's local fiat is converted to a stablecoin,
 * which a provider then delivers as local currency to the beneficiary.
 *
 * Mirrors POST /global-send/* on the backend.
 */

export interface GlobalSendCorridor {
  country: string;
  currency: string;
  provider: string;
  rails?: string[];
  /**
   * KYC tier the sender must hold. Read from the server rather than mirrored
   * here: the backend refuses the send on this same number, so a stale copy
   * would either block a send it would have accepted or promise one it will
   * reject after the user has filled the whole form.
   */
  minKycLevel?: number;
  /** Pays the sender's own linked bank account rather than a third party. */
  settlesToOwnAccount?: boolean;
  /** Whether to collect the beneficiary's name as free text. Defaults true. */
  needsBeneficiaryName?: boolean;
  /** Identifier fields this rail needs beyond name + account number. */
  extraFields?: ("routing" | "sort" | "institution" | "transit")[];
  /** The recipient's address fields this corridor needs. A send missing one
   * is refused before anything is debited. Absent where none is needed. */
  addressFields?: ("street" | "city" | "state" | "postalCode")[];
  /** Recipient details beyond name and account (China: CNAPS code, name in
   * Chinese, national ID, shipment tracking). */
  recipientFields?: (
    | "bankCode"
    | "nameInLocalLanguage"
    | "nationalIdNumber"
    | "logisticsTracking"
  )[];
  /** Documents the corridor requires, uploaded before sending. */
  requiredDocuments?: ("invoice" | "contract")[];
  /** The only reasons the corridor takes. Absent: any. */
  allowedPurposes?: PaymentPurpose[];
  /** The smallest send, in the stablecoin, after fees. */
  minAssetAmount?: number;
  /** The continent, for grouping destinations (see lib/regions). */
  region?: string;
  /** The recipient form, field by field; rendered by RecipientSchemaFields. */
  recipientSchema?: RecipientField[];
}

/** Beneficiary fields a recipient form can ask for. */
export type RecipientFieldKey =
  | "accountHolderName"
  | "accountNumber"
  | "bankName"
  | "bankCode"
  | "phone"
  | "iban"
  | "swiftCode"
  | "nationalIdNumber"
  | "nameInLocalLanguage";

/** One field of a corridor's recipient form, as the server describes it. */
export interface RecipientField {
  key: RecipientFieldKey;
  label: string;
  required: boolean;
  pattern?: string;
  patternHint?: string;
  options?: string[];
  keyboard?: "default" | "number" | "phone";
  placeholder?: string;
}

/** A shipment the payment is for. */
export interface LogisticsTracking {
  trackingNumber: string;
  carrierName: string;
  carrierCode?: string;
}

/** A document backing the payment; `storageKey` from POST /uploads/kyc-document. */
export interface SupportingDocument {
  type: "invoice" | "contract" | "other";
  storageKey: string;
}

export interface GlobalSendBeneficiary {
  accountHolderName: string;
  accountNumber: string;
  bankCode?: string;
  /** US only: ACH or WIRE. */
  rail?: string;
  email?: string;
  phone?: string;
  /** The recipient's own address, where the corridor asks for it. */
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  bankName?: string;
  iban?: string;
  swiftCode?: string;
  /** China: the recipient's name in Chinese characters. */
  nameInLocalLanguage?: string;
  /** China: the recipient's 18-character national ID. */
  nationalIdNumber?: string;
  logisticsTracking?: LogisticsTracking[];
  documents?: SupportingDocument[];
  extra?: Record<string, unknown>;
}

export interface GlobalSendResult {
  id: string;
  reference: string;
  status: string;
  asset: string | null;
  assetAmount: string | number | null;
  corridor: string;
  currency: string;
  /** The transfer fee taken out of the send; absent from an older server. */
  transferFee?: number;
  /** The reason for payment the send was made with, echoed back. */
  purpose?: PaymentPurpose | null;
  purposeNote?: string | null;
}

/** The labels a customer picks from, in the order they are offered. */
export const PAYMENT_PURPOSE_LABEL: Record<PaymentPurpose, string> = {
  FAMILY_SUPPORT: "Family support",
  EDUCATION: "Education / school fees",
  MEDICAL: "Medical",
  GOODS_PAYMENT: "Payment for goods",
  SERVICES_PAYMENT: "Payment for services",
  SALARY: "Salary / wages",
  TRAVEL: "Travel",
  RENT_PROPERTY: "Rent / property",
  GIFT: "Gift",
  OWN_ACCOUNT_TRANSFER: "Moving my own money",
  OTHER: "Other",
};

export const PAYMENT_PURPOSE_OPTIONS: readonly {
  value: PaymentPurpose;
  label: string;
}[] = PAYMENT_PURPOSES.map((value) => ({
  value,
  label: PAYMENT_PURPOSE_LABEL[value],
}));

export const isPaymentPurpose = (value: unknown): value is PaymentPurpose =>
  typeof value === "string" &&
  (PAYMENT_PURPOSES as readonly string[]).includes(value);

/** The customer-facing label for a purpose code, or null for none/unknown. */
export const paymentPurposeLabel = (value: unknown): string | null =>
  isPaymentPurpose(value) ? PAYMENT_PURPOSE_LABEL[value] : null;

export const PURPOSE_NOTE_MIN = 3;
export const PURPOSE_NOTE_MAX = 140;

/** Whether a reason is complete enough to send: chosen, and described in
 * 3-140 characters when it is Other. The note is only collected for Other. */
export const isPurposeComplete = (
  purpose: PaymentPurpose | null,
  note: string,
): boolean => {
  if (!purpose) return false;
  if (purpose !== "OTHER") return true;
  const length = note.trim().length;
  return length >= PURPOSE_NOTE_MIN && length <= PURPOSE_NOTE_MAX;
};

/** Server codes that mean the reason for payment is missing or incomplete.
 * Their messages are customer-ready. */
export const PAYMENT_PURPOSE_ERROR_CODES: ReadonlySet<string> = new Set([
  "PAYMENT_PURPOSE_REQUIRED",
  "PAYMENT_PURPOSE_NOTE_REQUIRED",
]);

/**
 * Price of a withdrawal to the sender's own bank account (GET
 * /user/withdraw/quote). The fee comes OUT of the amount: the balance is
 * debited `totalDebited` (what the user typed) and the bank receives `amount`.
 * A global send to an own-account corridor settles as exactly this withdrawal,
 * so this is its price too.
 */
export interface WithdrawalQuote {
  currency: string;
  /** What the bank account receives: the amount less the fee. */
  amount: number;
  fee: number;
  /** What leaves the balance -- the amount asked for. */
  totalDebited: number;
  feeBps: number;
  feeFlat: number;
}

/** POST /global-send/quote. Indicative: the rate is re-read at initiation. */
export interface GlobalSendQuote {
  sourceAmount: number;
  sourceCurrency: string;
  asset: string;
  assetAmount: number;
  rate: number;
  converted: boolean;
  /** Our fee, in `sourceCurrency`, already out of `assetAmount`. */
  partnerFee: number;
  /**
   * The cross-border transfer fee, in `sourceCurrency`, already out of
   * `assetAmount` like `partnerFee`: what is sent is sourceAmount less both.
   * Always 0 on a domestic payout, which pays the withdrawal fee instead.
   * Optional only so a server that predates it still parses (none charged).
   */
  transferFee?: number;
  /** What converting costs, in `sourceCurrency`: the gap between the market
   * rate and `rate` (our spread). Already inside `rate`, shown so it is not
   * hidden. 0 when nothing converts; absent from an older server. */
  conversionMargin?: number;
  /** That margin in basis points (30 = 0.3%). */
  conversionMarginBps?: number;
  destinationCountry: string;
  destinationCurrency: string;
  /** Estimate only; null where the corridor has no quotable rate. */
  estimatedDestinationAmount: number | null;
  destinationRate: number | null;
  /** The delivering partner's own fee, already taken off the estimate, where
   * it itemises one. Null where its cut is inside its rate, or with no
   * estimate. Optional only so a server that predates it still parses. */
  providerFee?: { amount: number; currency: string } | null;
}

export async function getWithdrawalQuote(
  amount: number,
): Promise<WithdrawalQuote> {
  const res = await api.get<{ data: WithdrawalQuote }>(
    `/user/withdraw/quote?amount=${encodeURIComponent(String(amount))}`,
  );
  return res.data;
}

export async function quoteGlobalSend(input: {
  amount: number;
  destinationCountry: string;
  asset?: string;
}): Promise<GlobalSendQuote> {
  // Read-only pricing; nothing is reserved, so a retry is harmless.
  const res = await api.post<{ data: GlobalSendQuote }>(
    "/global-send/quote",
    input,
    { retry: true },
  );
  return res.data;
}

/**
 * `amount` of `currency` for a rate: money formatting, with enough places
 * that a rate under one still reads (1 UGX = ₦0.4213, not ₦0.42).
 */
function formatRate(amount: number, currency: string): string {
  if (amount >= 1) return formatMoney(amount, currency);
  const digits = amount.toLocaleString("en-US", {
    maximumSignificantDigits: 4,
  });
  const symbol = currencyMeta(currency)?.symbol;
  return symbol ? `${symbol}${digits}` : `${digits} ${currency}`;
}

/**
 * The exchange rate behind a quote, always priced in what the customer pays
 * with: one unit of the destination currency in the sender's currency
 * ("1 GHS = ₦103.20"), which is `rate` (sender per asset) over
 * `destinationRate` (destination per asset). Where the corridor has no
 * quotable destination rate, the conversion into the coin is all there is to
 * show; null when nothing converts at all.
 */
export function exchangeRateLabel(quote: GlobalSendQuote): string | null {
  const { sourceCurrency: src, destinationCurrency: dest } = quote;
  if (quote.destinationRate && quote.destinationRate > 0 && quote.rate > 0) {
    if (src === dest) return null;
    return `1 ${dest} = ${formatRate(quote.rate / quote.destinationRate, src)}`;
  }
  if (quote.converted && quote.rate > 0) {
    return `1 ${quote.asset} = ${formatRate(quote.rate, src)}`;
  }
  return null;
}

/** `value`, once it has stopped changing for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * A live quote for the amount being typed, for showing the rate and what
 * arrives before review. Asked once typing pauses, kept briefly, never
 * retried on a refusal (an amount under the minimum is refused, and the
 * review explains that). Off for an own-account withdrawal.
 */
export function useGlobalSendPreview(input: {
  amount: number;
  destinationCountry: string;
  asset: string;
  enabled: boolean;
}) {
  const amount = useSettled(input.amount, 500);
  const ready =
    input.enabled &&
    !!input.destinationCountry &&
    !!input.asset &&
    Number.isFinite(amount) &&
    amount > 0;
  return useQuery({
    queryKey: [
      "global-send-preview",
      input.destinationCountry,
      input.asset,
      amount,
    ],
    queryFn: () =>
      quoteGlobalSend({
        amount,
        destinationCountry: input.destinationCountry,
        asset: input.asset,
      }),
    enabled: ready,
    staleTime: 30_000,
    retry: false,
    // While a new amount is priced, keep showing the last rate rather than
    // flashing it away.
    placeholderData: (previous) => previous,
  });
}

export const CORRIDORS_KEY = ["global-send-corridors"] as const;

/** Corridors and their tier requirements. Effectively static, so cached long. */
export function useCorridors() {
  return useQuery({
    queryKey: CORRIDORS_KEY,
    queryFn: getCorridors,
    staleTime: 30 * 60 * 1000,
  });
}

export async function getCorridors(): Promise<GlobalSendCorridor[]> {
  const res = await api.get<{
    data?: GlobalSendCorridor[] | { corridors?: GlobalSendCorridor[] };
  }>("/global-send/corridors");
  // The list is relayed from the partner API; a wrapped or missing payload must
  // land as "no corridors", never as a non-array the send form then calls
  // .find() on and crashes.
  const body = res.data;
  const list = Array.isArray(body) ? body : body?.corridors;
  return Array.isArray(list) ? list : [];
}

export async function initiateGlobalSend(input: {
  amount: number;
  destinationCountry: string;
  asset?: string;
  beneficiary: GlobalSendBeneficiary;
  /** Idempotency key — a retry must not debit twice. */
  reference?: string;
  /**
   * The invoice this payment is for, from uploadInvoice(). Required by the
   * server for a business account and ignored for a personal one, so the app
   * sends it rather than deciding who needs it.
   */
  invoiceId?: string;
  /**
   * Reason for payment. Required by the server on every cross-border
   * corridor; omitted on a withdrawal to the sender's own bank at home.
   */
  purpose?: PaymentPurpose;
  /** Describes the reason; required (3-140 characters) when it is OTHER. */
  purposeNote?: string;
  /** Authenticator code, when the account has 2FA on. Not part of the action:
   * the same send resubmitted with a code keeps its reference. */
  twoFactorCode?: string;
}): Promise<GlobalSendResult> {
  const res = await api.post<{ data: GlobalSendResult }>(
    "/global-send/initiate",
    input,
    // Never auto-retry a debit: a retried request that the server did receive
    // would look like a failure here while the money had already moved.
    { idempotencyKey: input.reference, retry: false },
  );
  return res.data;
}
