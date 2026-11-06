import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * In-app support. Threads live on the server rather than in an email client, so
 * a complaint about money has a record both sides can see.
 *
 * Mirrors /support/* on the backend.
 */

export type SupportCategory =
  "TRANSACTION" | "VERIFICATION" | "ACCOUNT" | "OTHER";

export type SupportTicketStatus =
  "OPEN" | "AWAITING_USER" | "RESOLVED" | "CLOSED";

export interface SupportMessage {
  id: string;
  authorType: "USER" | "ADMIN";
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  transactionReference: string | null;
  lastMessageAt: string;
  createdAt: string;
  messages?: SupportMessage[];
}

/** What each status means to the person who raised it, not to an agent. */
export const statusLabel = (status: SupportTicketStatus): string => {
  switch (status) {
    case "OPEN":
      return "With our team";
    case "AWAITING_USER":
      return "Needs your reply";
    case "RESOLVED":
      return "Resolved";
    case "CLOSED":
      return "Closed";
    default:
      return status;
  }
};

export const CATEGORIES: { key: SupportCategory; label: string }[] = [
  { key: "TRANSACTION", label: "A payment" },
  { key: "VERIFICATION", label: "Verification" },
  { key: "ACCOUNT", label: "My account" },
  { key: "OTHER", label: "Something else" },
];

export const TICKETS_KEY = ["support-tickets"] as const;
export const ticketKey = (id: string) => ["support-ticket", id] as const;

const unwrap = <T>(res: { data?: T }): T => res.data as T;

export async function fetchTickets(): Promise<SupportTicket[]> {
  const res = await api.get<{ data?: SupportTicket[] }>("/support/tickets");
  return Array.isArray(res.data) ? res.data : [];
}

export function useTickets() {
  return useQuery({ queryKey: TICKETS_KEY, queryFn: fetchTickets });
}

export async function fetchTicket(id: string): Promise<SupportTicket> {
  return unwrap(
    await api.get<{ data?: SupportTicket }>(
      `/support/tickets/${encodeURIComponent(id)}`,
    ),
  );
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ticketKey(id),
    queryFn: () => fetchTicket(id),
    // An agent's reply lands server-side with nothing to notify the device, so
    // poll while the thread is open and the ball is with us.
    refetchInterval: (q) => (q.state.data?.status === "OPEN" ? 20_000 : false),
  });
}

export async function raiseTicket(input: {
  subject: string;
  body: string;
  category?: SupportCategory;
  transactionReference?: string;
}): Promise<SupportTicket> {
  return unwrap(
    // Not retried: a blind retry would raise the same complaint twice, and two
    // tickets about one problem waste the user's time as well as an agent's.
    await api.post<{ data: SupportTicket }>("/support/tickets", input, {
      retry: false,
    }),
  );
}

export async function replyToTicket(
  id: string,
  body: string,
): Promise<SupportMessage> {
  return unwrap(
    await api.post<{ data: SupportMessage }>(
      `/support/tickets/${encodeURIComponent(id)}/reply`,
      { body },
      { retry: false },
    ),
  );
}
