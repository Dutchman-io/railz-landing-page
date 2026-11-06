"use client";

import { Suspense, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Loading } from "@/components/ui/Spinner";
import { CountryPicker, type CountryOption } from "@/components/common/CountryPicker";
import { InternationalAttention } from "@/components/common/InternationalAction";
import { DateField } from "@/components/kyc/DateField";
import { BusinessVerificationForm } from "@/components/kyc/BusinessVerificationForm";
import { useGoBack } from "@/components/kyc/useGoBack";
import { friendlyErrorMessage } from "@/lib/api";
import {
  KYC_PROFILE_KEY,
  KYC_STATUS_KEY,
  submitTier3,
  useKycProfile,
  useKycSummary,
  type BusinessTier3Request,
  type Tier3Request,
} from "@/lib/kyc";
import { countryDisplayName, countryName } from "@/lib/countryDisplay";
import { REGION_LABEL, REGION_ORDER, regionOf, regionsLabel } from "@/lib/regions";
import {
  INTERNATIONAL_STATUS_KEY,
  feeToPay,
  getInternationalStatus,
  sameGroup,
  useInternationalStatus,
  type InternationalGroupKey,
  type InternationalStatusView,
} from "@/lib/international";

/** yyyy-mm-dd, and a real date — "2026-02-31" parses to March in JS. */
const isValidDob = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/** The latest birthday an adult can have: today, 18 years ago. */
const latestAdultBirthday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
};

const earliestBirthday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
};

/** Whole years, counted on the calendar rather than by dividing milliseconds. */
const yearsSince = (value: string): number => {
  const [y, m, d] = value.split("-").map(Number);
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  const hadBirthday = now.getUTCMonth() + 1 > m || (now.getUTCMonth() + 1 === m && now.getUTCDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
};

const Label = ({ children }: { children: ReactNode }) => <p className="font-semibold">{children}</p>;
const Help = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted">{children}</p>;

/**
 * International verification: our partner abroad onboards the customer in
 * their own name before it will move money to or from the countries it
 * covers. NOT KYC Tier 3 (the address check at /app/kyc-address).
 *
 * Opened with a `destinationCountry` (from Send or Receive) it goes straight
 * to the form; opened without one (Settings, the dashboard) it first asks
 * where the customer wants to send to or receive from. `group` narrows that
 * choice to one partner's countries.
 */
function InternationalVerification() {
  const router = useRouter();
  const goBack = useGoBack();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const paramCountry = params.get("destinationCountry");
  const paramGroup = params.get("group");
  const { summary } = useKycSummary();
  const { data: kycProfile, isLoading: profileLoading } = useKycProfile();
  const international = useInternationalStatus();
  const [pickedCountry, setPickedCountry] = useState<string | null>(null);
  const destinationCountry = paramCountry || pickedCountry || undefined;

  // The countries still to unlock, grouped by partner. Approved partners are
  // left out: there is nothing to apply for.
  const countryOptions = useMemo<CountryOption[]>(() => {
    const groups = (international.data?.groups ?? []).filter(
      (g) => g.status !== "APPROVED" && (!paramGroup || sameGroup(g.key, paramGroup)),
    );
    // By continent, then name; the continent is in each name so typing
    // "Africa" finds every African country.
    const codes = [...new Set(groups.flatMap((g) => g.countries))].sort(
      (a, b) => REGION_ORDER.indexOf(regionOf(a)) - REGION_ORDER.indexOf(regionOf(b)) || countryName(a).localeCompare(countryName(b)),
    );
    return codes.map((code) => ({ code, name: `${countryDisplayName(code)} · ${REGION_LABEL[regionOf(code)]}` }));
  }, [international.data, paramGroup]);

  const destinationGroup = destinationCountry ? international.data?.groups.find((g) => g.countries.includes(destinationCountry)) : undefined;

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [subdivision, setSubdivision] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [editingDetails, setEditingDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; body: string } | null>(null);

  // Prefill from the saved profile whenever a new one arrives, during render
  // rather than in an effect, so the empty form never flashes.
  const [prefilledFrom, setPrefilledFrom] = useState<typeof kycProfile>(undefined);
  if (kycProfile && kycProfile !== prefilledFrom) {
    setPrefilledFrom(kycProfile);
    setDateOfBirth(kycProfile.dateOfBirth);
    setAddressLine1(kycProfile.addressLine1);
    setAddressLine2(kycProfile.addressLine2 ?? "");
    setCity(kycProfile.city);
    setSubdivision(kycProfile.subdivision ?? "");
    setPostalCode(kycProfile.postalCode ?? "");
    setEditingDetails(false);
  }

  // A business is verified as a company: its own form, and its readiness is
  // its business verification rather than a person's Tier 2.
  const isBusiness = international.data?.customerType === "BUSINESS";

  const kycLoading = summary.stage === "loading" || (!!destinationCountry && international.isPending);
  const needsTier2 = !kycLoading && !isBusiness && summary.approvedTier < 2;
  const businessNotVerified = !kycLoading && isBusiness && international.data?.eligible === false;

  // Said before the customer submits, never discovered on their statement.
  const fee = feeToPay(international.data);
  const feeNote = fee
    ? `International verification has a one-off fee of ${fee}, taken from ` +
      "your balance when you submit (or the equivalent in your local " +
      "currency). It is not refunded, and submitting again later is free."
    : null;
  const alreadyApproved = destinationGroup?.status === "APPROVED";

  const dobValid = isValidDob(dateOfBirth);
  const oldEnough = dobValid && yearsSince(dateOfBirth) >= 18;
  const missing: string[] = [
    !dateOfBirth.trim() ? "date of birth" : !dobValid ? "a valid date of birth" : !oldEnough ? "an age of 18 or over" : "",
    addressLine1.trim().length < 4 ? "street address" : "",
    !city.trim() ? "city" : "",
  ].filter(Boolean);

  const canSubmit = missing.length === 0 && !submitting && !kycLoading && !needsTier2 && !alreadyApproved && !!destinationCountry;
  const place = destinationCountry ? countryName(destinationCountry) : null;

  const onSubmit = () => {
    if (!canSubmit || !destinationCountry) return;
    void send({
      destinationCountry,
      dateOfBirth: dateOfBirth.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      subdivision: subdivision.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
    });
  };

  const send = async (payload: Tier3Request | BusinessTier3Request) => {
    if (!destinationCountry) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitTier3(payload);
      await queryClient.invalidateQueries({ queryKey: KYC_STATUS_KEY });
      await queryClient.invalidateQueries({ queryKey: KYC_PROFILE_KEY });
      // Read the outcome fresh, which also updates Settings and the dashboard.
      let fresh: InternationalStatusView | null = null;
      try {
        fresh = await queryClient.fetchQuery({ queryKey: INTERNATIONAL_STATUS_KEY, queryFn: getInternationalStatus, staleTime: 0 });
      } catch {
        // The submission went through; the status catches up on its next read.
        await queryClient.invalidateQueries({ queryKey: INTERNATIONAL_STATUS_KEY });
      }
      const endorsed = fresh?.groups.find((g) => g.countries.includes(destinationCountry))?.status === "APPROVED";
      setDone(
        endorsed
          ? { title: "Verified", body: `You can now send to and receive from ${place}.` }
          : {
              title: "Submitted for review",
              body: "Our partner is reviewing your details. This usually takes a short while, and you do not need to submit again.",
            },
      );
    } catch (err) {
      await queryClient.invalidateQueries({ queryKey: KYC_PROFILE_KEY });
      await queryClient.invalidateQueries({ queryKey: INTERNATIONAL_STATUS_KEY });
      setError(friendlyErrorMessage(err, "Submission failed. Check your network and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const changeCountry = !paramCountry && (
    <Button variant="ghost" size="sm" className="self-start" onClick={() => setPickedCountry(null)}>
      Change country ({place})
    </Button>
  );
  const doneButton = (
    <Button variant="secondary" onClick={goBack}>
      Done
    </Button>
  );

  let body: ReactNode;
  if (!destinationCountry) {
    body = (
      <CountryChoice
        loading={international.isPending}
        failed={international.isError}
        onRetry={() => void international.refetch()}
        options={countryOptions}
        groups={(international.data?.groups ?? []).filter((g) => g.status !== "APPROVED").map((g) => g.key)}
        allApproved={!!international.data && international.data.groups.length > 0 && international.data.groups.every((g) => g.status === "APPROVED")}
        onPick={setPickedCountry}
        doneButton={doneButton}
      />
    );
  } else if (kycLoading) {
    body = (
      <Card>
        <Loading label="Checking your verification" />
      </Card>
    );
  } else if (businessNotVerified) {
    body = (
      <Card className="flex flex-col gap-3">
        <Label>Your business is still being verified</Label>
        <Help>International verification opens once we have verified your business. We will let you know as soon as that is done.</Help>
        {doneButton}
      </Card>
    );
  } else if (needsTier2) {
    body = (
      <Card className="flex flex-col gap-3">
        <Label>Complete Tier 2 first</Label>
        <Help>Our partner needs your approved ID document, so international verification opens once Tier 2 is done.</Help>
        <Button variant="secondary" onClick={() => router.replace(summary.approvedTier < 1 ? "/app/kyc-tier1" : "/app/kyc-tier2")}>
          Complete Tier 2 first
        </Button>
      </Card>
    );
  } else if (alreadyApproved) {
    body = (
      <Card className="flex flex-col gap-3">
        <Label>Already enabled</Label>
        <Help>You can already send to and receive from {place}.</Help>
        {doneButton}
      </Card>
    );
  } else if (destinationGroup?.status === "NEEDS_ATTENTION" && destinationGroup.action) {
    // Our partner is waiting on the customer (its terms, more details):
    // submitting the form again would change nothing.
    body = (
      <Card className="flex flex-col gap-3">
        {changeCountry}
        <Label>One more step</Label>
        <InternationalAttention group={destinationGroup} onTryAgain={goBack} />
      </Card>
    );
  } else {
    body = (
      <Card className="flex flex-col gap-4">
        {changeCountry}
        {destinationGroup?.status === "NEEDS_ATTENTION" && destinationGroup.reason && <Alert>{destinationGroup.reason}</Alert>}
        {destinationGroup?.status === "IN_REVIEW" && (
          <Help>Your details are already with our partner. You only need to submit again if they have changed.</Help>
        )}
        {isBusiness ? (
          <BusinessVerificationForm
            feeNote={feeNote}
            submitting={submitting}
            error={error}
            onSubmit={(business) => void send({ destinationCountry, business })}
          />
        ) : (
          <>
            {profileLoading ? (
              <Help>Loading your saved KYC details…</Help>
            ) : kycProfile && !editingDetails ? (
              <>
                <Help>Using your date of birth and residential address from Tier 1.</Help>
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setEditingDetails(true)}>
                  Update saved details
                </Button>
              </>
            ) : (
              <>
                {!kycProfile && <Help>Add these details once. We’ll reuse them for future verifications.</Help>}
                <DateField
                  label="Date of birth"
                  placeholder="Select your date of birth"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  minimumDate={earliestBirthday()}
                  maximumDate={latestAdultBirthday()}
                />
                <Input label="Street address" placeholder="12 Marina Road" autoComplete="address-line1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
                <Input label="Apartment, suite (optional)" placeholder="Flat 4B" autoComplete="address-line2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="City" placeholder="Lagos" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
                  <Input
                    label="State or province"
                    placeholder="Required for US addresses"
                    autoComplete="address-level1"
                    value={subdivision}
                    onChange={(e) => setSubdivision(e.target.value)}
                  />
                </div>
                <Input label="Postal code (optional)" placeholder="100001" autoComplete="postal-code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </>
            )}

            <Help>This must be where you live — a PO Box is not accepted.</Help>
            {missing.length > 0 && <p className="text-sm text-warning">Still needed: {missing.join(", ")}.</p>}
            {feeNote && <Help>{feeNote}</Help>}
            <Alert>{error}</Alert>
            <Button loading={submitting} disabled={!canSubmit} onClick={onSubmit} block>
              Submit
            </Button>
          </>
        )}
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        back={{ href: "/app/settings", label: "Settings" }}
        title="International verification"
        subtitle={
          place
            ? `To send to or receive from ${place}, our partner abroad onboards you in your own name before it will move your money.`
            : "To send money abroad or receive it from abroad, our partner onboards you in your own name before it will move your money."
        }
      />
      {body}
      <Modal
        open={!!done}
        onClose={goBack}
        title={done?.title}
        footer={
          <Button onClick={goBack} block>
            Done
          </Button>
        }
      >
        <p>{done?.body}</p>
      </Modal>
    </>
  );
}

/** "Where do you want to send to or receive from?" — the choice decides which
 * partner the customer is enrolled with. */
function CountryChoice({
  loading,
  failed,
  onRetry,
  options,
  groups,
  allApproved,
  onPick,
  doneButton,
}: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  options: CountryOption[];
  groups: InternationalGroupKey[];
  allApproved: boolean;
  onPick: (code: string) => void;
  doneButton: ReactNode;
}) {
  if (loading) {
    return (
      <Card>
        <Loading label="Loading the countries we cover" />
      </Card>
    );
  }
  if (failed) {
    return (
      <Card className="flex flex-col gap-3">
        <Label>We couldn’t load this right now</Label>
        <Help>Check your connection and try again.</Help>
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </Card>
    );
  }
  if (allApproved) {
    return (
      <Card className="flex flex-col gap-3">
        <Label>International transfers are enabled</Label>
        <Help>You are verified with our partners abroad. There is nothing more to do.</Help>
        {doneButton}
      </Card>
    );
  }
  if (options.length === 0) {
    return (
      <Card className="flex flex-col gap-3">
        <Label>Not available right now</Label>
        <Help>International verification is not open at the moment. Please check back later.</Help>
        {doneButton}
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-3">
      <CountryPicker label="Where do you want to send to or receive from?" options={options} value={null} onChange={onPick} placeholder="Choose a country" />
      <Help>
        {groups.length > 0 ? `Covers ${regionsLabel(options.map((o) => o.code))}. ` : ""}
        You only need to do this once for each region.
      </Help>
    </Card>
  );
}

export default function KycTier3Page() {
  return (
    <div className="mx-auto max-w-xl">
      <Suspense fallback={<Loading />}>
        <InternationalVerification />
      </Suspense>
    </div>
  );
}
