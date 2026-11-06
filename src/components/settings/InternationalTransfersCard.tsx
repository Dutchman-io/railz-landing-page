"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { InternationalAttention } from "@/components/common/InternationalAction";
import { useKycSummary } from "@/lib/kyc";
import { featureState, useFeatures } from "@/lib/features";
import { countryName } from "@/lib/countryDisplay";
import {
  INTERNATIONAL_ROUTE,
  coverageText,
  groupLabel,
  useInternationalStatus,
  type InternationalGroup,
} from "@/lib/international";
import { Badge } from "./Badge";

const INTERNATIONAL_BADGE: Record<InternationalGroup["status"], { text: string; tone: "success" | "warning" } | null> = {
  NOT_STARTED: null,
  IN_REVIEW: { text: "In review", tone: "warning" },
  APPROVED: { text: "Enabled", tone: "success" },
  NEEDS_ATTENTION: { text: "Needs attention", tone: "warning" },
};

/**
 * Sending to and receiving from abroad. Not a KYC tier: our partner abroad
 * onboards the customer separately, per group of countries, so this has its
 * own status alongside the Verification card's tier. (Ported from zemfi-mobile.)
 */
export function InternationalTransfersCard() {
  const router = useRouter();
  const { summary } = useKycSummary();
  const { data: features } = useFeatures();
  const globalSend = featureState(features, "global_send");
  const { data, isPending, isError, refetch } = useInternationalStatus({ enabled: globalSend.enabled });

  // Switched off by the operator: the route refuses, so say nothing here.
  if (!globalSend.enabled) return null;

  const tierRoute = summary.approvedTier < 1 ? "/app/kyc-tier1" : "/app/kyc-tier2";
  const tier2InReview = summary.stage === "tier2-review";

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-sm text-muted">International transfers</p>
      {isPending ? (
        <p>Checking…</p>
      ) : isError || !data ? (
        <>
          <p>We couldn’t check this right now.</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </>
      ) : data.groups.length === 0 ? (
        <p>Not available right now.</p>
      ) : !data.eligible ? (
        <>
          <p>Send money abroad and receive from abroad once your ID document (Tier 2) is approved.</p>
          {tier2InReview ? (
            <p className="text-sm text-muted">Your ID document is in review.</p>
          ) : (
            <ButtonLink href={tierRoute} variant="secondary">
              Complete Tier 2 first
            </ButtonLink>
          )}
        </>
      ) : (
        data.groups.map((group) => {
          const badge = INTERNATIONAL_BADGE[group.status];
          const onApply = () => router.push(`${INTERNATIONAL_ROUTE}?group=${encodeURIComponent(group.key)}`);
          return (
            <div key={group.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* One partner needs no region heading; several do. */}
                  <p>{data.groups.length > 1 ? groupLabel(group) : "Send and receive abroad"}</p>
                  <p className="text-sm text-muted">{coverageText(group.countries, countryName)}</p>
                </div>
                {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
              </div>
              {group.status === "NOT_STARTED" ? (
                <Button onClick={onApply}>Apply</Button>
              ) : group.status === "NEEDS_ATTENTION" ? (
                <InternationalAttention group={group} onTryAgain={onApply} />
              ) : null}
            </div>
          );
        })
      )}
    </Card>
  );
}
