// Invoices a business sends its own customers, to be paid into its ZemFi
// accounts. Not ./invoices -- that is the supplier invoice a business attaches
// to a payment it makes.
//
// Mirrors /sales-invoices/* on the backend. The server does every sum: the app
// sends quantities and prices, and shows the totals it gets back.
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { formatMoney } from "./currency";

export type SalesInvoiceStatus = "DRAFT" | "SENT" | "PAID" | "VOID";

export interface SalesInvoiceItem {
  description: string;
  /** Decimal strings -- money through a JS number stops adding up. */
  quantity: string;
  unitPrice: string;
  amount: string;
}

export interface PaymentRow {
  label: string;
  value: string;
}

export interface SalesInvoice {
  id: string;
  number: string;
  /** What the payer quotes in their transfer. */
  reference: string;
  status: SalesInvoiceStatus;
  /** SENT and past its due date. */
  overdue: boolean;
  currency: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  /** yyyy-mm-dd */
  issueDate: string;
  dueDate: string;
  notes: string | null;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string;
  total: string;
  /** The public link, once sent. */
  payUrl: string | null;
  paymentDetails: { currency: string; rows: PaymentRow[] } | null;
  sentAt: string | null;
  lastEmailedAt: string | null;
  firstViewedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  /** On a single read only. */
  items?: SalesInvoiceItem[];
}

export interface DraftItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface SalesInvoiceDraft {
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  currency: string;
  issueDate?: string;
  dueDate: string;
  items: DraftItem[];
  taxRate?: string;
  notes?: string;
}

export const SALES_INVOICES_KEY = ["sales-invoices"] as const;
export const salesInvoiceKey = (id: string) => ["sales-invoice", id] as const;
export const INVOICE_CURRENCIES_KEY = ["sales-invoice-currencies"] as const;

const path = (id: string, suffix = "") =>
  `/sales-invoices/${encodeURIComponent(id)}${suffix}`;

const unwrap = <T>(res: { data?: T }): T => res.data as T;

export function useSalesInvoices() {
  return useQuery({
    queryKey: SALES_INVOICES_KEY,
    queryFn: async () => {
      const res = await api.get<{ data?: { items?: SalesInvoice[] } }>(
        "/sales-invoices",
      );
      return res.data?.items ?? [];
    },
  });
}

export function useSalesInvoice(id: string) {
  return useQuery({
    queryKey: salesInvoiceKey(id),
    queryFn: async () =>
      unwrap(await api.get<{ data?: SalesInvoice }>(path(id))),
    enabled: Boolean(id),
  });
}

/** Currencies the business can be paid in -- the only ones it can send in. */
export function useInvoiceCurrencies() {
  return useQuery({
    queryKey: INVOICE_CURRENCIES_KEY,
    queryFn: async () => {
      const res = await api.get<{ data?: { currencies?: string[] } }>(
        "/sales-invoices/currencies",
      );
      return res.data?.currencies ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export async function createSalesInvoice(
  draft: SalesInvoiceDraft,
): Promise<SalesInvoice> {
  return unwrap(
    await api.post<{ data?: SalesInvoice }>("/sales-invoices", draft),
  );
}

export async function updateSalesInvoice(
  id: string,
  draft: SalesInvoiceDraft,
): Promise<SalesInvoice> {
  return unwrap(await api.patch<{ data?: SalesInvoice }>(path(id), draft));
}

export async function deleteSalesInvoice(id: string): Promise<void> {
  await api.delete(path(id));
}

/** Sends a draft, or emails a reminder for a sent invoice. */
export async function sendSalesInvoice(
  id: string,
  email: boolean,
): Promise<{ invoice: SalesInvoice; emailed: boolean }> {
  return unwrap(
    await api.post<{ data?: { invoice: SalesInvoice; emailed: boolean } }>(
      path(id, "/send"),
      { email },
    ),
  );
}

export async function markSalesInvoicePaid(
  id: string,
  paidOn?: string,
): Promise<SalesInvoice> {
  return unwrap(
    await api.post<{ data?: SalesInvoice }>(
      path(id, "/mark-paid"),
      paidOn ? { paidOn } : {},
    ),
  );
}

export async function voidSalesInvoice(id: string): Promise<SalesInvoice> {
  return unwrap(await api.post<{ data?: SalesInvoice }>(path(id, "/void")));
}

/** The invoice as its customer sees it, as HTML, for printing to PDF. */
export async function fetchSalesInvoiceDocument(id: string): Promise<string> {
  const res = await api.get<{ data?: { html?: string } }>(
    path(id, "/document"),
  );
  return res.data?.html ?? "";
}

// ------------------------------------------------------------ presentation

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

/** What the business reads on a chip. Overdue is a SENT invoice, shown as
 * the thing that needs doing. */
export function statusDisplay(
  invoice: Pick<SalesInvoice, "status" | "overdue" | "firstViewedAt">,
): {
  label: string;
  tone: StatusTone;
} {
  switch (invoice.status) {
    case "DRAFT":
      return { label: "Draft", tone: "neutral" };
    case "PAID":
      return { label: "Paid", tone: "success" };
    case "VOID":
      return { label: "Cancelled", tone: "neutral" };
    default:
      if (invoice.overdue) return { label: "Overdue", tone: "danger" };
      return invoice.firstViewedAt
        ? { label: "Viewed", tone: "info" }
        : { label: "Sent", tone: "info" };
  }
}

/** A decimal string as money, for display only. */
export const showMoney = (amount: string, currency: string): string =>
  formatMoney(Number(amount), currency);

/** "26 Oct 2026" from yyyy-mm-dd, without a timezone shifting the day. */
export function showDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** yyyy-mm-dd for a day `days` from today, local time. */
export function isoInDays(days: number, from: Date = new Date()): string {
  const d = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + days,
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The editor's running total, for the business to see as they type. Not
 * what the invoice will say -- the server's sum is -- but the same rounding
 * (each line to cents, then tax on the subtotal), so the two agree.
 */
export function previewTotals(
  items: DraftItem[],
  taxRate: string,
): { subtotal: number; tax: number; total: number } {
  const cents = (n: number) => Math.round(n * 100);
  const subtotalCents = items.reduce((sum, item) => {
    const q = Number(item.quantity);
    const p = Number(item.unitPrice);
    if (!Number.isFinite(q) || !Number.isFinite(p)) return sum;
    return sum + cents(q * p);
  }, 0);
  const rate = Number(taxRate);
  const taxCents =
    Number.isFinite(rate) && rate > 0
      ? Math.round((subtotalCents * rate) / 100)
      : 0;
  return {
    subtotal: subtotalCents / 100,
    tax: taxCents / 100,
    total: (subtotalCents + taxCents) / 100,
  };
}

/** The message a business sends alongside the link, e.g. on WhatsApp. */
export function shareMessage(
  invoice: SalesInvoice,
  sellerName?: string,
): string {
  const from = sellerName ? ` from ${sellerName}` : "";
  return [
    `Invoice ${invoice.number}${from}`,
    `Amount due: ${showMoney(invoice.total, invoice.currency)}`,
    `Due: ${showDate(invoice.dueDate)}`,
    `Payment reference: ${invoice.reference}`,
    "",
    `View and pay: ${invoice.payUrl ?? ""}`,
  ].join("\n");
}
