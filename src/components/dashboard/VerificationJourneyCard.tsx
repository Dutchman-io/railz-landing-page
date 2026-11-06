"use client";

import { ButtonLink } from "@/components/ui/Button";
import { useKycSummary } from "@/lib/kyc";
import type { KycSummary } from "@/lib/kycSummary";

type Tier = 1 | 2 | 3;
type StepState = "approved" | "review" | "rejected" | "next" | "locked";

const STEPS: readonly { tier: Tier; title: string; unlocks: string; eta: string; route: string }[] = [
  { tier: 1, title: "Identity", unlocks: "Fund, convert and send", eta: "Usually instant", route: "/app/kyc-tier1" },
  { tier: 2, title: "ID document", unlocks: "Higher limits", eta: "Within one business day", route: "/app/kyc-tier2" },
  {
    tier: 3,
    title: "Address",
    unlocks: "Highest limits",
    // Not instant: our team first checks the bill's date, and only then is its
    // address compared with the one given at Tier 1.
    eta: "Usually within one business day",
    route: "/app/kyc-address",
  },
];

const stateOf = (summary: KycSummary, tier: Tier): StepState => {
  if (summary.approvedTier >= tier) return "approved";
  if (summary.pendingTier === tier) return "review";
  if (summary.rejectedTier === tier) return "rejected";
  if (summary.approvedTier === tier - 1 && !summary.awaitingReview) return "next";
  return "locked";
};

const STATE_LABEL: Record<StepState, string> = {
  approved: "Done",
  review: "In review",
  rejected: "Try again",
  next: "Next",
  locked: "",
};

const DOT: Record<StepState, string> = {
  approved: "bg-success border-success text-background",
  review: "border-warning",
  rejected: "border-danger",
  next: "border-primary",
  locked: "border-border",
};

const PILL: Record<StepState, string> = {
  approved: "bg-success text-background",
  review: "bg-warning text-background",
  rejected: "bg-danger text-background",
  next: "bg-wash text-muted",
  locked: "",
};

/**
 * The verification ladder as a checklist: where the user is, what each step
 * unlocks, how long it takes, and one button for the next thing to do.
 * Hidden once every tier is approved; quiet once Tier 2 is, since Tier 3 only
 * raises limits further. (Ported from zemfi-mobile.)
 */
export function VerificationJourneyCard() {
  const { summary } = useKycSummary();

  if (summary.stage === "loading" || summary.approvedTier === 3) return null;

  const states = STEPS.map((step) => stateOf(summary, step.tier));
  const actionable = STEPS.find((_, index) => ["next", "rejected"].includes(states[index]));
  const actionState = actionable ? states[STEPS.indexOf(actionable)] : undefined;
  const optional = summary.approvedTier >= 2;

  const title = summary.awaitingReview
    ? "Verification in review"
    : actionState === "rejected"
      ? "Verification needs another try"
      : summary.approvedTier === 0
        ? "Verify your identity"
        : "Raise your limits";

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border bg-surface p-5 sm:p-6 ${optional ? "border-border" : "border-warning"}`}
    >
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {summary.rejectionReason && actionState === "rejected" && (
        <p className="text-danger">{summary.rejectionReason}</p>
      )}

      <ol className="flex flex-col gap-4">
        {STEPS.map((step, index) => {
          const state = states[index];
          return (
            <li key={step.tier} className="flex items-start gap-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-bold ${DOT[state]}`}
              >
                {state === "approved" ? "✓" : step.tier}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-semibold ${state === "locked" ? "text-subtle" : ""}`}>{step.title}</p>
                  {STATE_LABEL[state] && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PILL[state]}`}>
                      {STATE_LABEL[state]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted">
                  {step.unlocks}
                  {state === "approved" ? "" : ` · ${step.eta}`}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {actionable ? (
        <ButtonLink href={actionable.route} variant={optional ? "secondary" : "primary"}>
          {actionState === "rejected" ? `Try Tier ${actionable.tier} again` : `Continue with Tier ${actionable.tier}`}
        </ButtonLink>
      ) : (
        <p className="text-sm text-muted">
          We are checking your details and will notify you as soon as there is a decision.
        </p>
      )}
    </div>
  );
}
