// Receiving foreign currency: a bank account in the user's name abroad, which
// converts what lands in it to stablecoin and credits their wallet.
//
// Mirrors /user/receiving-accounts/* on the backend.
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * Payer-facing bank details. The FIELDS DIFFER BY CURRENCY — USD returns a
 * routing and account number, EUR an IBAN and BIC, GBP an account number and
 * sort code, MXN a CLABE. Everything is optional and rendered from whatever is
 * present, so a currency we have not seen still shows the payer what it has
 * rather than an empty card.
 */
export interface DepositInstructions {
  currency?: string;
  payment_rails?: string[];
  bank_name?: string;
  bank_address?: string;
  bank_beneficiary_name?: string;
  bank_beneficiary_address?: string;
  bank_account_number?: string;
  bank_routing_number?: string;
  iban?: string;
  bic?: string;
  account_number?: string;
  sort_code?: string;
  clabe?: string;
  [key: string]: unknown;
}

export interface ReceivingAccount {
  id: string;
  currency: string;
  /** activated | pending | deactivated — as our partner reports it. */
  status: string;
  depositInstructions: DepositInstructions;
  settlement: {
    asset: string;
    network: string;
    address: string;
  };
}

export interface ReceivingActivity {
  id: string;
  /** funds_received | payment_submitted | payment_processed */
  type: string;
  amount: number | null;
  currency: string | null;
  senderName: string | null;
  description: string | null;
  txHash: string | null;
  occurredAt: string;
}

export const RECEIVING_ACCOUNTS_KEY = ["receiving-accounts"] as const;
export const RECEIVING_ACTIVITY_KEY = ["receiving-activity"] as const;
export const RECEIVING_CURRENCIES_KEY = ["receiving-currencies"] as const;

export async function fetchReceivingCurrencies(): Promise<string[]> {
  const res = await api.get<{ data?: { currencies?: string[] } }>(
    "/user/receiving-accounts/currencies",
    // Polled on a minute timer. See RequestOptions.background.
    { background: true },
  );
  return res.data?.currencies ?? [];
}

/** Served by the API so the app never hardcodes the set. */
export function useReceivingCurrencies() {
  return useQuery({
    queryKey: RECEIVING_CURRENCIES_KEY,
    queryFn: fetchReceivingCurrencies,
    staleTime: 60 * 60 * 1000,
  });
}

export async function fetchReceivingAccounts(): Promise<ReceivingAccount[]> {
  const res = await api.get<{ data?: ReceivingAccount[] }>(
    "/user/receiving-accounts",
    { background: true },
  );
  return Array.isArray(res.data) ? res.data : [];
}

export function useReceivingAccounts() {
  return useQuery({
    queryKey: RECEIVING_ACCOUNTS_KEY,
    queryFn: fetchReceivingAccounts,
  });
}

export async function fetchReceivingActivity(): Promise<ReceivingActivity[]> {
  const res = await api.get<{ data?: ReceivingActivity[] }>(
    "/user/receiving-accounts/activity",
    { background: true },
  );
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * Payments seen on the user's accounts, including ones still in flight.
 * Polled: a wire can take days, and nothing pushes the app.
 */
export function useReceivingActivity() {
  return useQuery({
    queryKey: RECEIVING_ACTIVITY_KEY,
    queryFn: fetchReceivingActivity,
    refetchInterval: 60_000,
  });
}

/**
 * Open the account for a currency, or return the one that exists.
 *
 * Idempotent server-side — asking twice returns the same account rather than
 * opening a second one a payer might send to by mistake — so a retry after a
 * failure is safe.
 */
export async function openReceivingAccount(
  currency: string,
): Promise<ReceivingAccount> {
  const res = await api.post<{ data: ReceivingAccount }>(
    `/user/receiving-accounts/${currency}`,
    undefined,
    { retry: false },
  );
  return res.data;
}

export async function refreshReceivingAccount(
  currency: string,
): Promise<ReceivingAccount> {
  const res = await api.post<{ data: ReceivingAccount }>(
    `/user/receiving-accounts/${currency}/refresh`,
    undefined,
    { retry: false },
  );
  return res.data;
}

/**
 * The deposit fields worth showing, in the order a payer fills a transfer form,
 * derived from what the currency actually returned.
 *
 * Driven by the payload rather than a per-currency template: the backend stores
 * whatever our partner sends, and a field we have not modelled must still reach
 * the payer.
 */
const FIELD_LABELS: Record<string, string> = {
  bank_beneficiary_name: "Account name",
  bank_account_number: "Account number",
  account_number: "Account number",
  bank_routing_number: "Routing number (ABA)",
  sort_code: "Sort code",
  iban: "IBAN",
  bic: "BIC / SWIFT",
  clabe: "CLABE",
  bank_name: "Bank",
  bank_address: "Bank address",
  bank_beneficiary_address: "Account holder address",
};

// Order matters: what identifies the account first, the bank around it after.
const FIELD_ORDER = [
  "bank_beneficiary_name",
  "bank_account_number",
  "account_number",
  "iban",
  "bank_routing_number",
  "sort_code",
  "bic",
  "clabe",
  "bank_name",
  "bank_address",
  "bank_beneficiary_address",
];

export function depositFields(
  instructions: DepositInstructions,
): { key: string; label: string; value: string }[] {
  const seen = new Set<string>();
  const out: { key: string; label: string; value: string }[] = [];

  for (const key of FIELD_ORDER) {
    const value = instructions[key];
    if (typeof value === "string" && value.trim()) {
      out.push({ key, label: FIELD_LABELS[key] ?? key, value });
      seen.add(key);
    }
  }
  // Anything the partner sent that we have not modelled — shown rather than
  // dropped, because a missing field can be the one a payer's bank demands.
  for (const [key, value] of Object.entries(instructions)) {
    if (seen.has(key) || key === "currency" || key === "payment_rails")
      continue;
    if (typeof value === "string" && value.trim()) {
      out.push({ key, label: FIELD_LABELS[key] ?? humanise(key), value });
    }
  }
  return out;
}

function humanise(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One line a user can paste into a chat or email to their payer. */
export function shareableSummary(account: ReceivingAccount): string {
  const lines = depositFields(account.depositInstructions).map(
    (f) => `${f.label}: ${f.value}`,
  );
  const rails = account.depositInstructions.payment_rails;
  if (rails?.length) lines.push(`Accepts: ${rails.join(", ")}`);
  return [`${account.currency} account details`, ...lines].join("\n");
}

/** Plain-English stage, so a user is not shown our partner's vocabulary. */
export function activityLabel(type: string): string {
  switch (type) {
    case "funds_received":
      return "Payment received — converting";
    case "payment_submitted":
      return "Converted — arriving in your wallet";
    case "payment_processed":
      return "Completed";
    default:
      return type.replace(/_/g, " ");
  }
}
