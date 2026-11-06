// International transfers: sending to and receiving from abroad.
//
// NOT a KYC tier. Tier 3 is the address check that raises domestic limits.
// This is a separate capability: our partner abroad onboards the customer in
// their own name before it will move their money, one partner per group of
// countries. The screen for it lives at /kyc-tier3 for old deep links, but it
// is "International verification" everywhere the customer can see.
import { regionsLabel } from "./regions";
import { useQuery } from "@tanstack/react-query";
type Href = string;
import { api } from "./api";

export type InternationalStatus =
  "NOT_STARTED" | "IN_REVIEW" | "APPROVED" | "NEEDS_ATTENTION";

/** Region a partner covers, never the partner itself. `china` is the old
 * name for `africa_asia`, still sent while older builds are in use. */
export type InternationalGroupKey = "americas_europe" | "africa_asia" | "china";

/** A detail our partner needs: a stable key and a label ready to show. */
export interface InternationalDetailField {
  key: string;
  label: string;
}

/** What the customer can do about NEEDS_ATTENTION. The server reads anything
 * it has no words for as CONTACT_SUPPORT. */
export type InternationalAction =
  | { type: "ACCEPT_TERMS" }
  | { type: "ANSWER_QUESTIONNAIRE" }
  | { type: "PROVIDE_DETAILS"; fields: InternationalDetailField[] }
  | { type: "CONTACT_SUPPORT" };

export interface InternationalGroup {
  key: InternationalGroupKey;
  status: InternationalStatus;
  /** Why, when NEEDS_ATTENTION. */
  reason?: string;
  /** What to do, when NEEDS_ATTENTION because our partner is waiting on the
   * customer. Absent for a refusal, which is answered by submitting again. */
  action?: InternationalAction;
  /** ISO alpha-2 countries this enrolment unlocks. */
  countries: string[];
}

/** The one-off international verification fee. */
export interface InternationalRegistrationFee {
  /** Decimal string in `currency`; "0" when none applies. */
  amount: string;
  currency: "USDT";
  /** PARTNER: ZemFi pays it, so the customer is charged nothing. */
  paidBy: "CUSTOMER" | "PARTNER";
  /** Already taken; submitting again is free. */
  paid: boolean;
}

export interface InternationalStatusView {
  /** Ready to enrol: Tier 2 approved, or the business verified. */
  eligible: boolean;
  /** A BUSINESS submits company details; an INDIVIDUAL only a country. */
  customerType: "INDIVIDUAL" | "BUSINESS";
  /** Null from a server that predates the fee. */
  registrationFee: InternationalRegistrationFee | null;
  groups: InternationalGroup[];
}

/** What the customer will be charged for this submission, or null for nothing. */
export const feeToPay = (
  view: Pick<InternationalStatusView, "registrationFee"> | undefined,
): string | null => {
  const fee = view?.registrationFee;
  if (!fee || fee.paid || fee.paidBy !== "CUSTOMER") return null;
  return Number(fee.amount) > 0 ? `${fee.amount} ${fee.currency}` : null;
};

export const INTERNATIONAL_STATUS_KEY = ["international-status"] as const;

/** The in-app route for the international flow. `destinationCountry` skips the
 * country picker; without it the screen asks. */
export const INTERNATIONAL_ROUTE = "/app/kyc-tier3" as const;

export const internationalHref = (destinationCountry?: string): Href =>
  destinationCountry
    ? `${INTERNATIONAL_ROUTE}?destinationCountry=${encodeURIComponent(destinationCountry)}`
    : INTERNATIONAL_ROUTE;

/**
 * A verification group's name. Each group is one partner's verification,
 * named by the continents its countries are in ("Africa, Asia & Middle
 * East"), never by a single country: the payments partner's `china` group covers far more
 * than China. The fixed names are for when no countries are known.
 */
export const GROUP_LABEL: Record<InternationalGroupKey, string> = {
  americas_europe: "Americas & Europe",
  africa_asia: "Africa, Asia & more",
  china: "Africa, Asia & more",
};

/** Whether two keys name the same group: `china` and `africa_asia` do. */
export const sameGroup = (a?: string | null, b?: string | null): boolean => {
  const canonical = (k?: string | null) => (k === "china" ? "africa_asia" : k);
  return canonical(a) === canonical(b);
};

export const groupLabel = (group: {
  key: InternationalGroupKey;
  countries?: string[];
}): string =>
  group.countries?.length
    ? regionsLabel(group.countries)
    : GROUP_LABEL[group.key];

const toView = (
  data: InternationalStatusView | undefined,
): InternationalStatusView => ({
  eligible: data?.eligible === true,
  customerType: data?.customerType === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL",
  registrationFee: data?.registrationFee ?? null,
  groups: Array.isArray(data?.groups) ? data.groups : [],
});

export async function getInternationalStatus(): Promise<InternationalStatusView> {
  const res = await api.get<{ data?: InternationalStatusView }>(
    "/global-send/international-status",
  );
  return toView(res.data);
}

/** Ask our partner for its decision now rather than at its next scheduled
 * check — right after the customer comes back from accepting its terms. */
export async function refreshInternationalStatus(): Promise<InternationalStatusView> {
  const res = await api.post<{ data?: InternationalStatusView }>(
    "/global-send/international-status/refresh",
  );
  return toView(res.data);
}

/** The page where the customer accepts our partner's terms. Short-lived:
 * fetched each time, never stored. */
export async function getInternationalTermsLink(
  group: InternationalGroupKey,
): Promise<string> {
  const res = await api.get<{ data?: { url?: string } }>(
    `/global-send/international-terms-link?group=${encodeURIComponent(group)}`,
  );
  const url = res.data?.url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    throw new Error("We could not open our partner's terms right now.");
  }
  return url;
}

// ------------------------------------------- source-of-funds questionnaire

/** The screen where the customer answers our partner's questions about
 * their money, for a group whose action is ANSWER_QUESTIONNAIRE. */
export const INTERNATIONAL_QUESTIONS_ROUTE =
  "/app/international-questions" as const;

export const internationalQuestionsHref = (
  group: InternationalGroupKey,
): Href => `${INTERNATIONAL_QUESTIONS_ROUTE}?group=${encodeURIComponent(group)}`;

/** One answer to pick: a stable key to send back and a label to show. */
export interface QuestionnaireOption {
  key: string;
  label: string;
}

export interface QuestionnaireChoice {
  label: string;
  options: QuestionnaireOption[];
}

/** GET /global-send/international-questionnaire. Every label is ready to
 * show; the server keeps them vendor-neutral. */
export interface InternationalQuestionnaire {
  group: InternationalGroupKey;
  helperText: string;
  sourceOfFunds: QuestionnaireChoice;
  accountPurpose: QuestionnaireChoice & {
    /** The option that needs `accountPurposeOther`. */
    otherKey: string;
    otherLabel: string;
    otherMaxLength: number;
  };
  employmentStatus: QuestionnaireChoice;
  /** `key` is the occupation code. Hundreds long: shown searchable. */
  occupation: QuestionnaireChoice;
  expectedMonthlyPayments: QuestionnaireChoice;
  actingAsIntermediary: { label: string };
  /** What the customer last sent, to prefill; null if never. */
  answers: Partial<Record<keyof QuestionnaireAnswers, string | boolean>> | null;
}

export interface QuestionnaireAnswers {
  sourceOfFunds: string;
  accountPurpose: string;
  /** Only when accountPurpose is the `otherKey`, and then required. */
  accountPurposeOther?: string;
  employmentStatus: string;
  occupation: string;
  expectedMonthlyPayments: string;
  actingAsIntermediary: boolean;
}

/** Codes the questionnaire routes answer with, beyond the usual ones. */
export const QUESTIONNAIRE_INVALID = "INTERNATIONAL_QUESTIONNAIRE_INVALID";
export const QUESTIONNAIRE_NOT_REQUIRED =
  "INTERNATIONAL_QUESTIONNAIRE_NOT_REQUIRED";
export const QUESTIONNAIRE_UNAVAILABLE =
  "INTERNATIONAL_QUESTIONNAIRE_UNAVAILABLE";

export const internationalQuestionnaireKey = (group: InternationalGroupKey) =>
  ["international-questionnaire", group] as const;

export async function getInternationalQuestionnaire(
  group: InternationalGroupKey,
): Promise<InternationalQuestionnaire> {
  const res = await api.get<{ data?: InternationalQuestionnaire }>(
    `/global-send/international-questionnaire?group=${encodeURIComponent(group)}`,
  );
  if (!res.data) {
    throw new Error("We could not load the questions right now.");
  }
  return res.data;
}

/** Send the answers; the server passes them to our partner, re-checks, and
 * answers with the new international status. */
export async function submitInternationalQuestionnaire(
  group: InternationalGroupKey,
  answers: QuestionnaireAnswers,
): Promise<InternationalStatusView> {
  const res = await api.post<{ data?: InternationalStatusView }>(
    `/global-send/international-questionnaire?group=${encodeURIComponent(group)}`,
    answers,
  );
  return toView(res.data);
}

export function useInternationalQuestionnaire(group: InternationalGroupKey) {
  return useQuery({
    queryKey: internationalQuestionnaireKey(group),
    queryFn: () => getInternationalQuestionnaire(group),
    staleTime: 5 * 60_000,
  });
}

/** "Tax identification number and Proof of address". */
export const detailsText = (fields: InternationalDetailField[]): string => {
  const labels = fields.map((f) => f.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
};

export function useInternationalStatus(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: INTERNATIONAL_STATUS_KEY,
    queryFn: getInternationalStatus,
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    // The partner decides on its own schedule. Re-read now and then while a
    // decision is outstanding, so an approval shows without a restart.
    refetchInterval: (q) =>
      q.state.data?.groups.some((g) => g.status === "IN_REVIEW")
        ? 5 * 60_000
        : false,
  });
}

/** Every group is approved (and there is at least one). */
export const allApproved = (view: InternationalStatusView): boolean =>
  view.groups.length > 0 && view.groups.every((g) => g.status === "APPROVED");

/** The group to act on first: one needing attention, then not started, then
 * in review. Null when every group is approved. */
export const nextGroup = (
  view: InternationalStatusView,
): InternationalGroup | null => {
  const order: InternationalStatus[] = [
    "NEEDS_ATTENTION",
    "NOT_STARTED",
    "IN_REVIEW",
  ];
  for (const status of order) {
    const found = view.groups.find((g) => g.status === status);
    if (found) return found;
  }
  return null;
};

/** "United States, United Kingdom, Germany and 22 more" — from the server's
 * list, so a new corridor needs no copy change. */
export const coverageText = (
  countries: string[],
  nameOf: (code: string) => string,
  shown = 3,
): string => {
  const names = countries.slice(0, shown).map(nameOf);
  const rest = countries.length - names.length;
  if (rest > 0) return `${names.join(", ")} and ${rest} more`;
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};
