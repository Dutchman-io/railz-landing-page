// Bank directory access (PRD SCR-004). Fetches the supported Nigerian bank list
// from the backend so the registry screen can offer a real, searchable dropdown,
// and resolves an account name once a bank + 10-digit NUBAN are entered.
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { Bank } from '@/types/api';

// The backend returns a trimmed, sorted { code, name }[] under the standard
// `data` envelope (SuccessResponse → { data: Bank[] }). Older builds nested the
// raw provider payload one level deeper ({ data: { data: Bank[] } }), so we
// unwrap defensively and always hand back an array.
export async function fetchBanks(country?: string): Promise<Bank[]> {
  const res = await api.get<unknown>('/bank/get-banks', {
    params: country ? { country } : undefined,
  });
  const level1 = (res as { data?: unknown })?.data;
  if (Array.isArray(level1)) return level1 as Bank[];
  const level2 = (level1 as { data?: unknown })?.data;
  if (Array.isArray(level2)) return level2 as Bank[];
  return [];
}

// React Query hook — parameterized by country code so changing country re-fetches
// the appropriate bank list. Pass null while no country is chosen yet: nothing
// is fetched, rather than the server's default directory.
export function useBanks(country?: string | null) {
  return useQuery({
    queryKey: ['banks', country ?? 'default'],
    queryFn: () => fetchBanks(country ?? undefined),
    enabled: country !== null,
    staleTime: 60 * 60 * 1000, // 1h — bank directory is effectively static
  });
}

// Resolve the account holder name for a bank + NUBAN via Fincra (backend proxy).
// Not retried — a failed resolve usually means a wrong bank/number, not a blip.
export async function resolveAccountName(
  accountNumber: string,
  bankCode: string,
): Promise<string> {
  const res = await api.post<{ data: { accountName: string } }>(
    '/bank/verify-account',
    { accountNumber, bankCode },
    { retry: false },
  );
  return res.data.accountName;
}

// Fires automatically once a bank is selected and 10 digits are entered. The
// query key includes both inputs so changing either re-resolves.
export function useResolvedAccount(bankCode?: string, accountNumber?: string) {
  return useQuery({
    queryKey: ['resolve-account', bankCode, accountNumber],
    queryFn: () => resolveAccountName(accountNumber as string, bankCode as string),
    enabled: !!bankCode && accountNumber?.length === 10,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

// The persisted payout account as returned by POST /user/add-account under the
// standard `data` envelope. Mirrors the backend BankAccount model.
export interface SavedBankAccount {
  id: string;
  userId: string;
  bankCode: string;
  currency: string;
  accountNumber: string;
  isVerified: boolean;
  isDefault: boolean;
  createdAt: string;
}

export interface AddBankAccountInput {
  accountNumber: string;
  bankCode: string;
  currency: string;
}

// Persist a verified payout account (SCR-004 save step). The backend re-resolves
// the name and re-checks it against the user's verified identity server-side, so
// we deliberately send only the raw inputs — never the client-resolved name.
// Not retried: it's a create, and a retry on a duplicate would surface a 409.
export async function addBankAccount(
  input: AddBankAccountInput,
): Promise<SavedBankAccount> {
  const res = await api.post<{ data: SavedBankAccount }>(
    '/user/add-account',
    input,
    { retry: false },
  );
  return res.data;
}

// Query key for the user's saved payout accounts — invalidated after any
// add/delete/set-default so every screen sees the same list.
export const ACCOUNTS_KEY = ['bank-accounts'] as const;

export async function fetchAccounts(): Promise<SavedBankAccount[]> {
  const res = await api.get<{ data?: SavedBankAccount[] }>('/user/accounts');
  return Array.isArray(res.data) ? res.data : [];
}

// The user's linked payout accounts, default first (the backend orders them).
export function useAccounts() {
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  });
}

// Remove a linked account. If it was the default, the backend promotes another.
export async function deleteBankAccount(id: string): Promise<void> {
  await api.delete(`/user/accounts/${id}`, { retry: false });
}

// Make a linked account the default payout destination.
export async function setDefaultBankAccount(id: string): Promise<void> {
  await api.patch(`/user/accounts/${id}/default`, undefined, { retry: false });
}
