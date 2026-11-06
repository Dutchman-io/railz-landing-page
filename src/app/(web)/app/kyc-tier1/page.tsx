"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Loading } from "@/components/ui/Spinner";
import { DateField } from "@/components/kyc/DateField";
import { Choice } from "@/components/kyc/Choice";
import { SelfieCamera } from "@/components/kyc/SelfieCamera";
import { apiErrorCode, friendlyErrorMessage } from "@/lib/api";
import {
  KYC_PROFILE_KEY,
  KYC_STATUS_KEY,
  checkSelfie,
  isSupportedDocument,
  submitTier1,
  toLocalDocument,
  uploadKycDocument,
  useKycSummary,
  type LocalDocument,
  type SelfieCheck,
} from "@/lib/kyc";
import { compressDocument } from "@/lib/compressImage";
import { useAuth } from "@/state/auth";

/**
 * JPEG quality for the selfie. Higher than documents: the partner matches it
 * against the BVN photo, and heavy compression smears what that match needs.
 */
const SELFIE_QUALITY = 0.85;

interface Outcome {
  tone: "pending" | "error";
  message: string;
}

/** The selfie, and its storage key once uploaded (it is uploaded to be checked). */
interface Selfie {
  doc: LocalDocument;
  storageKey: string | null;
}

/** yyyy-mm-dd, and a real date — "2026-02-31" parses to March in JS. */
const isValidDob = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
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

type Step = "bvn" | "details" | "photo";

const latestAdultBirthday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
};

const earliestBirthday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
};

/** No face, or someone else in shot, refuse the photo; anything else can be overridden. */
const isBlocking = (check: SelfieCheck): boolean => check.faceDetected === false || check.multipleFaces === true;

export default function KycTier1Page() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { summary } = useKycSummary();
  // BVN verification is Nigeria-only for now; other countries see a "coming
  // soon" state (the backend also gates them).
  const comingSoon = !!user?.country && user.country.toUpperCase() !== "NG";
  // A business account verifies a PERSON here -- the director acting for the
  // company -- while the company itself is checked separately.
  const isBusiness = user?.accountType === "BUSINESS";

  const [bvn, setBvn] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [occupation, setOccupation] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [subdivision, setSubdivision] = useState("");
  const [postalCode, setPostalCode] = useState("");
  /**
   * Starts null, not false: an unanswered declaration is missing evidence
   * rather than an answer of "no".
   */
  const [isPep, setIsPep] = useState<boolean | null>(null);
  const [selfie, setSelfie] = useState<Selfie | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [checkingSelfie, setCheckingSelfie] = useState(false);
  // A photo the check had something to say about, waiting on "Use" or "Retake".
  const [review, setReview] = useState<{ selfie: Selfie; check: SelfieCheck } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  /**
   * Three screens, but still ONE submission: the checks are weighed together
   * and get a single verdict. The steps are presentation only.
   */
  const [step, setStep] = useState<Step>("bvn");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const priorRejection: Outcome | null =
    summary.stage === "tier1-rejected" && summary.rejectionReason ? { tone: "error", message: summary.rejectionReason } : null;

  const dobValid = isValidDob(dateOfBirth);
  const oldEnough = dobValid && yearsSince(dateOfBirth) >= 18;
  const detailsReady =
    oldEnough &&
    occupation.trim().length >= 2 &&
    addressLine1.trim().length >= 2 &&
    city.trim().length >= 2 &&
    subdivision.trim().length >= 2 &&
    isPep !== null;

  const accept = (s: Selfie) => {
    setSelfie(s);
    setReview(null);
    setOutcome(null);
  };

  const onCaptured = async (file: File) => {
    setCameraOpen(false);
    setPhotoError(null);
    const doc = toLocalDocument(file);
    if (!isSupportedDocument(doc)) {
      setPhotoError("That image cannot be used. Take the photo again — JPEG, PNG or WEBP only.");
      return;
    }
    setCheckingSelfie(true);
    // Shrunk before it is uploaded, so a slow connection is not carrying
    // detail nobody needs.
    const compressed = await compressDocument(doc, SELFIE_QUALITY);
    // Uploaded now so the server can check it, so a dark or distant photo is
    // retaken now rather than failing the face match and waiting on a
    // reviewer. Advisory: a failed upload or check lets the photo through,
    // and the upload is retried on submit.
    let storageKey: string | null = null;
    let check: SelfieCheck | null = null;
    try {
      storageKey = (await uploadKycDocument(compressed)).storageKey;
      check = await checkSelfie(storageKey);
    } catch {
      // Uploaded again on submit, where a failure is reported.
    }
    setCheckingSelfie(false);
    const captured = { doc: compressed, storageKey };
    if (!check || check.guidance.length === 0) {
      accept(captured);
      return;
    }
    setReview({ selfie: captured, check });
  };

  const onSubmit = async () => {
    if (bvn.length !== 11 || !detailsReady || !selfie) return;
    setOutcome(null);
    setSubmitting(true);
    try {
      const selfieStorageKey = selfie.storageKey ?? (await uploadKycDocument(selfie.doc)).storageKey;

      const result = await submitTier1({
        bvn,
        dateOfBirth,
        occupation: occupation.trim(),
        addressLine1: addressLine1.trim(),
        ...(addressLine2.trim() ? { addressLine2: addressLine2.trim() } : {}),
        city: city.trim(),
        subdivision: subdivision.trim(),
        ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
        isPoliticallyExposed: isPep,
        selfieStorageKey,
      });
      // The server can answer without a record when the check could not be
      // completed.
      const record = result?.kyc ?? result?.record ?? null;
      if (!record) {
        setOutcome({ tone: "error", message: "We couldn't finish checking your details. Please try again." });
      } else if (result.retakeSelfie) {
        // Only the selfie let them down: back to the camera, details kept.
        setStep("photo");
        setSelfie(null);
        setOutcome({ tone: "error", message: record.rejectionReason ?? "Your selfie was not clear enough. Retake it in good light." });
      } else if (result.status === "REJECTED") {
        // Approved or queued for review, the status view takes over once the
        // refetch lands. Only a rejection leaves the form up.
        setStep("bvn");
        setOutcome({ tone: "error", message: record.rejectionReason ?? "We could not verify your details. Check them and try again." });
      }
      await queryClient.invalidateQueries({ queryKey: KYC_STATUS_KEY });
      await queryClient.invalidateQueries({ queryKey: KYC_PROFILE_KEY });
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "KYC_IN_REVIEW" || code === "KYC_ALREADY_VERIFIED") {
        // Already submitted (another device, or a retry after a timeout): the
        // refetch swaps the form for the status view.
        await queryClient.invalidateQueries({ queryKey: KYC_STATUS_KEY });
        return;
      }
      setOutcome({ tone: "error", message: friendlyErrorMessage(err, "Verification failed. Check your network and try again.") });
    } finally {
      setSubmitting(false);
    }
  };

  const stepNumber = step === "bvn" ? "1" : step === "details" ? "2" : "3";
  const stepName = step === "bvn" ? "BVN" : step === "details" ? "Your details" : "Photo";
  const shown = outcome ?? priorRejection;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        back={{ href: "/app/settings", label: "Settings" }}
        title={isBusiness ? "Verify the director" : "Verify your identity"}
        subtitle={
          <>
            {!comingSoon && summary.canSubmitTier1 && (
              <span className="mb-1 block text-sm font-medium text-primary">
                Step {stepNumber} of 3 · {stepName}
              </span>
            )}
            {comingSoon
              ? "We're expanding identity verification to more countries."
              : isBusiness
                ? "We verify the person acting for the company. Use the details of a director — not the company’s. The company itself is checked separately against the register."
                : "Tier 1 unlocks higher daily limits. We match instantly against your records."}
          </>
        }
      />

      {comingSoon ? (
        <Card className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-semibold text-warning">Coming soon</h2>
          <p className="text-muted">
            Identity verification isn&apos;t available in your country yet. We&apos;ll let you know the moment it is — you can keep
            exploring the app in the meantime.
          </p>
        </Card>
      ) : summary.stage === "loading" ? (
        <Card>
          <Loading />
        </Card>
      ) : summary.canSubmitTier1 ? (
        <Card className="flex flex-col gap-5">
          {step === "bvn" && (
            <Input
              label={isBusiness ? "Director's BVN" : "Your BVN"}
              placeholder="11-digit BVN"
              inputMode="numeric"
              maxLength={11}
              value={bvn}
              onChange={(e) => {
                setBvn(e.target.value.replace(/\D/g, ""));
                setOutcome(null);
              }}
            />
          )}

          {step === "details" && (
            <>
              <DateField
                label="Date of birth"
                placeholder="Select your date of birth"
                value={dateOfBirth}
                onChange={(date) => {
                  setDateOfBirth(date);
                  setOutcome(null);
                }}
                minimumDate={earliestBirthday()}
                maximumDate={latestAdultBirthday()}
              />
              <Input label="Occupation" placeholder="What you do for a living" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
              <Input label="Home address" placeholder="Street and number" autoComplete="address-line1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
              <Input label="Apartment, suite (optional)" autoComplete="address-line2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="City" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
                <Input label="State" autoComplete="address-level1" value={subdivision} onChange={(e) => setSubdivision(e.target.value)} />
              </div>
              <Input label="Postcode (optional)" inputMode="numeric" autoComplete="postal-code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              <div className="flex flex-col gap-2">
                <p className="font-semibold">Are you, or someone close to you, a senior public official?</p>
                <p className="text-sm text-muted">
                  A politically exposed person — for example a government minister, a senior judge, or a close family member of one. It does
                  not prevent verification; it means your account is reviewed more closely, which is a legal requirement.
                </p>
                <Choice
                  label="Senior public official"
                  options={[
                    { label: "No", value: false },
                    { label: "Yes", value: true },
                  ]}
                  value={isPep}
                  onChange={setIsPep}
                />
              </div>
            </>
          )}

          {step === "photo" && (
            <div className="flex flex-col gap-3">
              <p className="font-semibold">A photo of you</p>
              <p className="text-sm text-muted">
                Taken now rather than uploaded, and matched against the photo held for your BVN — that match is what makes this a check on you,
                not on a number somebody knows.
              </p>
              <p className="text-sm text-muted">
                Face a window or a bright light, hold the phone at eye level, and keep your whole face in the photo. No cap, sunglasses or face
                covering.
              </p>
              {selfie && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                  <img src={selfie.doc.uri} alt="Your photo" className="size-16 rounded-xl object-cover" />
                  <p className="text-sm text-success">Photo ready.</p>
                </div>
              )}
              <Button
                variant={selfie ? "ghost" : "primary"}
                onClick={() => {
                  setPhotoError(null);
                  setCameraOpen(true);
                }}
                loading={checkingSelfie}
                disabled={submitting}
              >
                {selfie ? "Retake photo" : "Take photo"}
              </Button>
              <Alert>{photoError}</Alert>
            </div>
          )}

          {/* Falls back to the stored reason so a returning user sees why they were declined. */}
          {shown && <Alert tone={shown.tone === "pending" ? "warning" : "danger"}>{shown.message}</Alert>}

          {step === "bvn" && (
            <Button
              onClick={() => {
                setOutcome(null);
                setStep("details");
              }}
              // Length only. Whether the number is real is the server's answer.
              disabled={bvn.length !== 11}
              block
            >
              Continue
            </Button>
          )}
          {step === "details" && (
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setOutcome(null);
                  setStep("photo");
                }}
                disabled={!detailsReady}
                block
              >
                Continue
              </Button>
              <Button variant="ghost" onClick={() => setStep("bvn")} disabled={submitting} block>
                Back
              </Button>
            </div>
          )}
          {step === "photo" && (
            <div className="flex flex-col gap-2">
              <Button onClick={() => void onSubmit()} loading={submitting} disabled={bvn.length !== 11 || !detailsReady || !selfie || checkingSelfie} block>
                Verify
              </Button>
              <Button variant="ghost" onClick={() => setStep("details")} disabled={submitting} block>
                Back
              </Button>
            </div>
          )}

          <p className="text-center text-sm text-subtle">
            Your details are sent over an encrypted connection and used only to verify your identity. They are checked together, so nothing is
            sent until the last step.
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          {summary.awaitingReview ? (
            <>
              <h2 className="font-display text-lg font-semibold text-warning">Under review</h2>
              <p className="text-muted">
                Your details are with our compliance team. We will notify you as soon as a decision is made — there is nothing more to do here.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-lg font-semibold text-success">Identity verified</h2>
              <p className="text-muted">Tier 1 limits are active. Submit an ID document to raise them further.</p>
              {summary.canSubmitTier2 && <ButtonLink href="/app/kyc-tier2">Continue to Tier 2</ButtonLink>}
            </>
          )}
        </Card>
      )}

      <SelfieCamera open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(file) => void onCaptured(file)} />

      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title={review && isBlocking(review.check) ? "Take the photo again" : "This photo may not match"}
        footer={
          review && (
            <>
              <Button
                onClick={() => {
                  setReview(null);
                  setCameraOpen(true);
                }}
                block
              >
                Retake
              </Button>
              {!isBlocking(review.check) && (
                <Button variant="ghost" onClick={() => accept(review.selfie)} block>
                  Use this photo
                </Button>
              )}
            </>
          )
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          {review?.check.guidance.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </Modal>
    </div>
  );
}
