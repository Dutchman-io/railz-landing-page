// Bill payments: airtime, data, cable TV and electricity, paid from the NGN
// balance. Mirrors the backend /bills endpoints (catalogue, validate, quote,
// pay, history).
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "./api";

export type BillType = "AIRTIME" | "DATA" | "CABLE_TV" | "ELECTRICITY";

export const BILL_TYPES: readonly BillType[] = [
  "AIRTIME",
  "DATA",
  "CABLE_TV",
  "ELECTRICITY",
];

/** What each type is called, and what it asks for. */
export const BILL_TYPE_INFO: Record<
  BillType,
  {
    title: string;
    body: string;
    provider: string;
    identifier: string;
    identifierPlaceholder: string;
  }
> = {
  AIRTIME: {
    title: "Airtime",
    body: "Top up any network",
    provider: "Network",
    identifier: "Phone number",
    identifierPlaceholder: "0803 123 4567",
  },
  DATA: {
    title: "Data",
    body: "Bundles for any line",
    provider: "Network",
    identifier: "Phone number",
    identifierPlaceholder: "0803 123 4567",
  },
  CABLE_TV: {
    title: "Cable TV",
    body: "Renew a subscription",
    provider: "TV provider",
    identifier: "Smartcard / IUC number",
    identifierPlaceholder: "7012345678",
  },
  ELECTRICITY: {
    title: "Electricity",
    body: "Prepaid and postpaid",
    provider: "Electricity company",
    identifier: "Meter number",
    identifierPlaceholder: "45031234567",
  },
};

/** Airtime and data are bought for a phone number. */
export const isPhoneBill = (type: BillType): boolean =>
  type === "AIRTIME" || type === "DATA";

/** TV and electricity: the holder's name is confirmed with the biller first. */
export const needsValidation = (type: BillType): boolean => !isPhoneBill(type);

/** Data and TV are sold as plans; airtime and electricity by amount. */
export const hasPlans = (type: BillType): boolean =>
  type === "DATA" || type === "CABLE_TV";

/** Quick amounts, in naira. */
export const QUICK_AMOUNTS: Partial<Record<BillType, number[]>> = {
  AIRTIME: [100, 200, 500, 1000, 2000],
  ELECTRICITY: [2000, 5000, 10000, 20000],
};

/**
 * "08031234567" from anything a person types or the profile holds: spaces,
 * dashes, +234 or 234. Null when it is not a Nigerian mobile number.
 */
export function nigerianMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("234")) digits = `0${digits.slice(3)}`;
  else if (digits.length === 10) digits = `0${digits}`;
  return /^0[789][01]\d{8}$/.test(digits) ? digits : null;
}

export interface BillCategory {
  id: string;
  type: BillType;
  name: string;
  isFixedAmount: boolean;
  logoUrl: string | null;
}

export interface BillProduct {
  code: string;
  name: string;
  /** NGN. Null when the customer chooses the amount. */
  amount: number | null;
  isAmountFixed: boolean;
  validity: string | null;
}

export interface BillValidation {
  customerIdentifier: string;
  /** The meter or smartcard holder. Null for airtime and data. */
  customerName: string | null;
  vendType: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  /** Electricity: debt outstanding on the meter. */
  outstanding: number | null;
  address: string | null;
}

/** Fees are on top of the face value: totalDebited = amount + fee. */
export interface BillQuote {
  amount: number;
  fee: number;
  totalDebited: number;
  currency: string;
}

export type BillStatus = "PROCESSING" | "COMPLETED" | "FAILED" | "REVERSED";

export interface BillPayment {
  reference: string;
  type: BillType;
  categoryId: string;
  billerName: string | null;
  productName: string | null;
  customerIdentifier: string;
  customerName: string | null;
  /** Decimal strings. */
  amount: string;
  fee: string;
  totalDebited: string;
  status: BillStatus;
  /** Electricity token, once the biller issues it. */
  token: string | null;
  failureReason: string | null;
  createdAt: string;
}

/** A number paid before, offered in one tap. */
export interface RecentBill {
  categoryId: string;
  billerName: string | null;
  customerIdentifier: string;
  customerName: string | null;
}

/** How many recent numbers to offer per type. */
const RECENTS_PER_TYPE = 5;

/**
 * Newest first in, newest first out: the numbers recently paid for one
 * type. Failed and reversed payments are left out (perhaps a wrong
 * number). A phone is one entry whatever the network, the latest winning;
 * a meter or smartcard is one entry per biller.
 */
export function recentBills(bills: BillPayment[], type: BillType): RecentBill[] {
  const seen = new Set<string>();
  const out: RecentBill[] = [];
  for (const b of bills) {
    if (b.type !== type || b.status === "FAILED" || b.status === "REVERSED") {
      continue;
    }
    const key = isPhoneBill(type)
      ? b.customerIdentifier
      : `${b.categoryId}:${b.customerIdentifier}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      categoryId: b.categoryId,
      billerName: b.billerName,
      customerIdentifier: b.customerIdentifier,
      customerName: b.customerName,
    });
    if (out.length === RECENTS_PER_TYPE) break;
  }
  return out;
}

export const RECENT_BILLS_KEY = ["bills", "recent"] as const;

/** The latest bills, for recents. A failed read just means no suggestions. */
export function useRecentBills(type: BillType) {
  const query = useQuery({
    queryKey: RECENT_BILLS_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<{ data?: { bills?: BillPayment[] } }>(
        "/bills",
        { params: { limit: 50 }, background: true },
      );
      return res.data?.bills ?? [];
    },
  });
  return useMemo(
    () => recentBills(query.data ?? [], type),
    [query.data, type],
  );
}

export function useBillCategories(type: BillType, enabled = true) {
  return useQuery({
    queryKey: ["bill-categories", type],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await api.get<{ data?: BillCategory[] }>(
        "/bills/categories",
        { params: { type }, retry: true },
      );
      return res.data ?? [];
    },
  });
}

export function useBillProducts(categoryId: string | undefined) {
  return useQuery({
    queryKey: ["bill-products", categoryId],
    enabled: !!categoryId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await api.get<{ data?: BillProduct[] }>(
        `/bills/categories/${encodeURIComponent(categoryId!)}/products`,
        { retry: true },
      );
      return res.data ?? [];
    },
  });
}

export async function validateBill(input: {
  categoryId: string;
  customerIdentifier: string;
}): Promise<BillValidation> {
  const res = await api.post<{ data: BillValidation }>(
    "/bills/validate",
    input,
    { retry: true },
  );
  return res.data;
}

/** Read-only pricing; nothing is reserved, so a retry is harmless. */
export async function quoteBill(input: {
  type: BillType;
  categoryId: string;
  productCode?: string;
  amount?: number;
}): Promise<BillQuote> {
  const res = await api.get<{ data: BillQuote }>("/bills/quote", {
    params: input,
    retry: true,
  });
  return res.data;
}

export async function payBill(input: {
  type: BillType;
  categoryId: string;
  productCode?: string;
  amount?: number;
  customerIdentifier: string;
  twoFactorCode?: string;
  /** Idempotency key for this payment (useActionReference). */
  reference: string;
}): Promise<BillPayment> {
  const res = await api.post<{ data: BillPayment }>("/bills", input, {
    idempotencyKey: input.reference,
    retry: false,
  });
  return res.data;
}

export async function fetchBill(reference: string): Promise<BillPayment> {
  const res = await api.get<{ data: BillPayment }>(
    `/bills/${encodeURIComponent(reference)}`,
    { background: true },
  );
  return res.data;
}
