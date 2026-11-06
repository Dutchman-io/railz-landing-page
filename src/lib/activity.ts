// Presentation helpers for ledger activity, shared by the history list and the
// transaction detail screen.
import { LedgerActivity } from "./wallet";
import { formatMoney, currencyName } from "./currency";

/**
 * A human label for a ledger entry.
 *
 * Every branch is phrased in terms of what moved and in which direction —
 * never the raw `reason`. That used to fall through, so an internal code like
 * "admin.adjustment" or "crypto_send" was shown to users verbatim.
 */
/** A buy or sell shown as one swap: what went out, and what came in. */
export const isSwap = (
  tx: LedgerActivity,
): tx is LedgerActivity & { counterAmount: number; counterCurrency: string } =>
  (tx.reason === "buy" || tx.reason === "sell") &&
  typeof tx.counterAmount === "number" &&
  typeof tx.counterCurrency === "string";

/** "+3.66 USDT": what a swap brought in; null for anything else. */
export const formatCounter = (tx: LedgerActivity): string | null =>
  isSwap(tx) ? `+${formatMoney(tx.counterAmount, tx.counterCurrency)}` : null;

export const activityLabel = (tx: LedgerActivity): string => {
  const asset = currencyName(tx.currency);
  if (isSwap(tx)) {
    return `Swapped ${tx.currency} → ${tx.counterCurrency}`;
  }
  switch (tx.reason) {
    case "deposit":
      return `${asset} received`;
    case "fiat.deposit":
      return `${asset} funding`;
    case "sell":
      return tx.type === "DEBIT" ? `Sold ${asset}` : `Sold for ${asset}`;
    case "buy":
      return tx.type === "DEBIT" ? `Bought with ${asset}` : `Bought ${asset}`;
    case "withdrawal":
      return "Withdrawal to bank";
    case "withdrawal.reversal":
      return "Withdrawal reversed";
    case "crypto_send":
      return `${asset} sent`;
    case "crypto_send.reversal":
      return `${asset} send reversed`;
    case "global.send":
      return "Sent abroad";
    case "global.send.refund":
      return "International transfer refunded";
    case "global.send.reversal":
      return "International transfer reversed";
    case "global.send.fee":
      return "International transfer fee";
    case "international.kyc.fee":
      return "International verification fee";
    case "offramp.settlement":
      return "Sale settled";
    case "admin.adjustment":
      return `${asset} adjustment`;
    case "liquidity.contribution":
      return `${asset} supplied`;
    case "liquidity.withdrawal":
      return `${asset} returned`;
    case "liquidity.reward":
      return "Liquidity reward";
    case "liquidity.reserved":
      return `${asset} reserved`;
    case "liquidity.released":
      return `${asset} released`;
    default:
      // Unknown reason: say what actually happened rather than leaking a code.
      return tx.type === "DEBIT" ? `${asset} sent` : `${asset} received`;
  }
};

export const isCredit = (tx: LedgerActivity): boolean => tx.type !== "DEBIT";

export const formatAmount = (tx: LedgerActivity): string =>
  `${isCredit(tx) ? "+" : "−"}${formatMoney(tx.amount, tx.currency)}`;

export const formatWhen = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// BROADCASTING/PENDING_LIQUIDITY previously fell through to "Completed",
// telling a user their money had arrived while it was still in flight.
const STATUS_LABELS: Record<string, string> = {
  FAILED: "Failed",
  PROCESSING: "Processing",
  BROADCASTING: "Sending",
  PENDING_LIQUIDITY: "Processing",
  CONFIRMED: "Completed",
  COMPLETED: "Completed",
};

export const statusLabel = (status: LedgerActivity["status"]): string =>
  STATUS_LABELS[status] ?? "Processing";
