"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InternationalAttention } from "@/components/common/InternationalAction";
import { useKycSummary } from "@/lib/kyc";
import { featureState, useFeatures } from "@/lib/features";
import { countryName } from "@/lib/countryDisplay";
import { allApproved, coverageText, internationalHref, nextGroup, useInternationalStatus } from "@/lib/international";

/**
 * The way in to international transfers for a customer whose KYC is far
 * enough along (Tier 2) but who is not yet approved by our partner abroad.
 * Hidden below Tier 2 (the verification card covers that) and once every
 * partner has approved them. (Ported from zemfi-mobile.)
 */
export function InternationalCard() {
  const router = useRouter();
  const { summary } = useKycSummary();
  const { data: features } = useFeatures();
  const tierReady = summary.approvedTier >= 2;
  const globalSend = featureState(features, "global_send");
  const { data } = useInternationalStatus({ enabled: tierReady && globalSend.enabled });

  if (!tierReady || !globalSend.enabled || !data || !data.eligible) return null;
  if (data.groups.length === 0 || allApproved(data)) return null;
  const group = nextGroup(data);
  if (!group) return null;

  const coverage = coverageText(
    data.groups.filter((g) => g.status !== "APPROVED").flatMap((g) => g.countries),
    countryName,
  );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Send and receive abroad</h2>
        {group.status === "IN_REVIEW" && (
          <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-semibold text-background">In review</span>
        )}
      </div>
      {group.status === "IN_REVIEW" ? (
        <p className="text-muted">
          Our partner is reviewing your details. We will let you know as soon as there is a decision.
        </p>
      ) : group.status === "NEEDS_ATTENTION" ? (
        <InternationalAttention group={group} onTryAgain={() => router.push(internationalHref())} />
      ) : (
        <>
          <p className="text-muted">
            Get verified with our partner abroad to send to and receive from {coverage}.
          </p>
          <Button variant="secondary" onClick={() => router.push(internationalHref())}>
            Apply
          </Button>
        </>
      )}
    </Card>
  );
}
