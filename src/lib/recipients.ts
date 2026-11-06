// Saved Send destinations, kept by zemfi-backend (/user/recipients).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface Recipient {
  id: string;
  kind: "CRYPTO" | "BANK";
  label: string;
  asset: string | null;
  network: string | null;
  address: string | null;
  country: string | null;
  currency: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  bankCode: string | null;
  rail: string | null;
  extra: Record<string, string> | null;
  lastUsedAt: string;
}

export type SaveRecipientInput =
  Omit<Recipient, "id" | "lastUsedAt"> extends infer T
    ? { [K in keyof T]?: T[K] | undefined } & {
        kind: "CRYPTO" | "BANK";
        label: string;
      }
    : never;

export const RECIPIENTS_KEY = ["recipients"] as const;

export async function fetchRecipients(): Promise<Recipient[]> {
  const res = await api.get<{ data?: { recipients?: Recipient[] } }>(
    "/user/recipients",
  );
  return res.data?.recipients ?? [];
}

export function useRecipients() {
  const query = useQuery({
    queryKey: RECIPIENTS_KEY,
    queryFn: fetchRecipients,
    staleTime: 5 * 60_000,
  });
  return query;
}

const compact = <T extends Record<string, unknown>>(input: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<T>;

export async function saveRecipient(
  input: SaveRecipientInput,
): Promise<Recipient> {
  const res = await api.post<{ data: { recipient: Recipient } }>(
    "/user/recipients",
    compact(input),
    { retry: false },
  );
  return res.data.recipient;
}

export async function deleteRecipient(id: string): Promise<void> {
  await api.delete(`/user/recipients/${encodeURIComponent(id)}`);
}

/** Fire-and-forget after a send to a saved recipient. */
export function touchRecipient(id: string): void {
  void api
    .post(`/user/recipients/${encodeURIComponent(id)}/used`, undefined, {
      retry: false,
    })
    .catch(() => undefined);
}

export function useInvalidateRecipients() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: RECIPIENTS_KEY });
}

/** "TXYZ…1234" for chips and review rows. */
export const shortAddress = (value: string): string =>
  value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
