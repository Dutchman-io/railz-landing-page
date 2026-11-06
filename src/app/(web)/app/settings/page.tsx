"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/state/auth";
import { useKycSummary, type KycStage } from "@/lib/kyc";
import { PRIVACY_POLICY_URL, TERMS_URL } from "@/lib/legal";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink, buttonClass } from "@/components/ui/Button";
import { Badge } from "@/components/settings/Badge";
import { InternationalTransfersCard } from "@/components/settings/InternationalTransfersCard";

// Wording for each stage of the ladder. `action` is null wherever there is
// nothing for the user to do, notably while a submission is under review.
const VERIFICATION_VIEW: Record<
  KycStage,
  { value: string; badge: string; tone: "success" | "warning"; action: { label: string; route: string } | null }
> = {
  loading: { value: "Checking…", badge: "TIER —", tone: "warning", action: null },
  unstarted: {
    value: "Not verified",
    badge: "TIER 0",
    tone: "warning",
    action: { label: "Complete verification", route: "/app/kyc-tier1" },
  },
  "tier1-review": { value: "Under review", badge: "TIER 0", tone: "warning", action: null },
  "tier1-rejected": { value: "Declined", badge: "TIER 0", tone: "warning", action: { label: "Try again", route: "/app/kyc-tier1" } },
  "tier1-approved": {
    value: "Identity verified",
    badge: "TIER 1",
    tone: "success",
    action: { label: "Upgrade account", route: "/app/kyc-tier2" },
  },
  "tier2-review": { value: "Document under review", badge: "TIER 1", tone: "warning", action: null },
  "tier2-rejected": {
    value: "Document declined",
    badge: "TIER 1",
    tone: "warning",
    action: { label: "Resubmit document", route: "/app/kyc-tier2" },
  },
  // No Tier 3 action: the address check is arranged by our team, not
  // self-served. The row still reports Tier 3 once granted.
  verified: { value: "Approved", badge: "TIER 2", tone: "success", action: null },
};

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <p className="text-sm text-muted">{label}</p>
      {children}
    </Card>
  );
}

const external = (href: string, label: string) => (
  <a href={href} target="_blank" rel="noopener" className={buttonClass("secondary")}>
    {label}
  </a>
);

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { summary } = useKycSummary();
  // Tier 3 has no stage of its own: `stage` tops out at 'verified'. Read it
  // from the summary instead, or the row goes on offering the address check
  // after it has been submitted, and after it has been approved.
  const view =
    summary.approvedTier === 3
      ? { value: "Approved", badge: "TIER 3", tone: "success" as const, action: null }
      : summary.tier3Pending
        ? { value: "Address under review", badge: "TIER 2", tone: "success" as const, action: null }
        : VERIFICATION_VIEW[summary.stage];
  const action = view.action;

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs font-semibold tracking-widest text-primary">SETTINGS</p>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {user?.firstName} {user?.lastName}
        </h1>
        <p className="text-muted">{user?.email}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Section label="Account">
            <p>View your personal information.</p>
            <ButtonLink href="/app/profile" variant="secondary">
              Profile
            </ButtonLink>
          </Section>

          <Section label="Security">
            <p>Add an authenticator app for sign-in and withdrawals.</p>
            <ButtonLink href="/app/two-factor" variant="secondary">
              Two-factor authentication
            </ButtonLink>
            <p>See every device signed in to your account, and sign any of them out.</p>
            <ButtonLink href="/app/sessions" variant="secondary">
              Devices
            </ButtonLink>
          </Section>

          <Section label="Verification">
            <div className="flex items-center justify-between gap-3">
              <p>{view.value}</p>
              <Badge tone={view.tone}>{view.badge}</Badge>
            </div>
            {action && <ButtonLink href={action.route}>{action.label}</ButtonLink>}
          </Section>

          <InternationalTransfersCard />
        </div>

        <div className="flex flex-col gap-6">
          <Section label="Payouts">
            <p>Sale proceeds stay on your balance until you withdraw them. Manage the bank accounts you withdraw to.</p>
            <ButtonLink href="/app/bank-accounts" variant="secondary">
              Bank account
            </ButtonLink>
          </Section>

          <Section label="Help">
            <p>Contact support, or read our terms and how we handle your data.</p>
            <a href="mailto:support@zemfi.ng" className={buttonClass("secondary")}>
              Support
            </a>
            {external(PRIVACY_POLICY_URL, "Privacy policy")}
            {external(TERMS_URL, "Terms of service")}
          </Section>

          <Section label="Close account">
            <p>
              Delete your account and the personal details we hold. Verification and transaction records are kept — the
              next screen says which, and for how long.
            </p>
            <ButtonLink href="/app/delete-account" variant="secondary">
              Delete account
            </ButtonLink>
          </Section>

          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
