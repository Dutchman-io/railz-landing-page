// Wallet: the user's balances (coins and local fiat alike), their deposit
// addresses, and withdrawal to a bank.
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { WalletBalance } from "@/types/api";

const REFRESH_MS = 60000; // Fallback 60s freshness loop (SSE handles real-time updates)

export const BALANCES_KEY = ["balances"] as const;
export const DEPOSIT_ADDRESSES_KEY = ["deposit-addresses"] as const;

export async function fetchBalances(): Promise<WalletBalance[]> {
  const res = await api.get<{ data?: { balances?: WalletBalance[] } }>(
    "/user/balance",
  );
  return res.data?.balances ?? [];
}

/**
 * The balance, polled. zemfi-mobile also opens /user/balance/stream, but a
 * browser EventSource cannot send the Bearer token, so on the web it would be
 * refused and retried forever; polling alone keeps the figure current.
 */
export function useBalances() {
  return useQuery({
    queryKey: BALANCES_KEY,
    queryFn: fetchBalances,
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });
}

export function balanceOf(
  balances: WalletBalance[] | undefined,
  currency: string,
): number {
  return balances?.find((b) => b.currency === currency)?.balance ?? 0;
}

export interface DepositAddress {
  network: string;
  address: string;
}

export async function fetchDepositAddresses(): Promise<DepositAddress[]> {
  const res = await api.get<{ data?: { addresses?: DepositAddress[] } }>(
    "/user/addresses",
  );
  return res.data?.addresses ?? [];
}

export function useDepositAddresses() {
  return useQuery({
    queryKey: DEPOSIT_ADDRESSES_KEY,
    queryFn: fetchDepositAddresses,
    staleTime: 60 * 60 * 1000, // addresses are stable for the session
  });
}

export interface LedgerActivity {
  id: string;
  type: "CREDIT" | "DEBIT" | "REVERSAL";
  reason: string;
  currency: string;
  amount: number;
  // Crypto sends add BROADCASTING/CONFIRMED; the API reports the withdrawal's
  // real state rather than assuming a debit means done.
  status:
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "BROADCASTING"
    | "CONFIRMED"
    | "PENDING_LIQUIDITY";
  reference: string;
  /** A swap's other side: `counterAmount` of `counterCurrency` came in for
   * `amount` of `currency`. Null (or absent, from an older server) otherwise. */
  counterAmount?: number | null;
  counterCurrency?: string | null;
  /** On-chain hash for crypto deposits/sends; null for fiat movements. */
  txHash: string | null;
  /** Chain the hash belongs to, for building an explorer link. */
  network: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface ActivityPage {
  transactions: LedgerActivity[];
  nextCursor: string | null;
}

// Recent balance movements (deposits, sells, withdrawals, fiat funding),
// cursor-paginated for infinite scroll.
export function useTransactions() {
  return useInfiniteQuery({
    queryKey: ["transactions"],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ActivityPage> => {
      const qs = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : "";
      const res = await api.get<{ data?: ActivityPage }>(
        `/user/transactions${qs}`,
      );
      return {
        transactions: res.data?.transactions ?? [],
        nextCursor: res.data?.nextCursor ?? null,
      };
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export interface VirtualAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  currency: string;
  status: string;
}

// The user's NGN funding account — created on first request (needs approved BVN).
export function useVirtualAccount() {
  return useQuery<VirtualAccount>({
    queryKey: ["virtual-account"],
    queryFn: async () => {
      const res = await api.get<{ data: VirtualAccount }>(
        "/user/virtual-account",
      );
      return res.data;
    },
    staleTime: 60 * 60 * 1000, // account details are stable
    retry: false, // a 400 (BVN required) shouldn't be retried
  });
}

// Currencies with a persistent virtual account (mirror of the backend gate).
// Others (ZAR/UGX) fund via a one-off charge instead.

// A fund-by-charge result: either a one-off bank account to pay into
// (bank_transfer) or a redirect URL to authorise at the bank (eft).
export interface FundingCharge {
  reference: string;
  type: "bank_transfer" | "eft";
  currency: string;
  amount: number;
  status: string;
  accountNumber?: string | null;
  accountName?: string | null;
  bankName?: string | null;
  bankCode?: string | null;
  narration?: string | null;
  expiresAt?: string | null;
  redirectUrl?: string | null;
}

// Start a fund-by-charge for `amount` of the user's local fiat. Not retried
// (money). `reference` is the idempotency key for this funding action: pass
// the same one when the user retries the same amount (useActionReference).
export async function initiateFundingCharge(
  amount: number,
  reference: string,
): Promise<FundingCharge> {
  const res = await api.post<{ data: FundingCharge }>(
    "/user/funding/charge",
    { amount, reference },
    { idempotencyKey: reference, retry: false },
  );
  return res.data;
}
