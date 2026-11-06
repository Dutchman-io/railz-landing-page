"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Loading } from "@/components/ui/Spinner";
import { Choice } from "@/components/kyc/Choice";
import { FilePick, IMAGE_ACCEPT } from "@/components/kyc/FilePick";
import { friendlyErrorMessage } from "@/lib/api";
import type { IdDocumentType } from "@/types/api";
import { ID_DOCUMENTS, documentSpec, needsBack } from "@/lib/idDocuments";
import { compressDocument, fileSizeBytes, formatBytes } from "@/lib/compressImage";
import {
  KYC_STATUS_KEY,
  MAX_UPLOAD_BYTES,
  isSupportedDocument,
  submitTier2,
  toLocalDocument,
  uploadFailureMessage,
  uploadKycDocument,
  useKycSummary,
  type KycStage,
  type LocalDocument,
} from "@/lib/kyc";

export default function KycTier2Page() {
  const queryClient = useQueryClient();
  const { summary } = useKycSummary();
  const [front, setFront] = useState<LocalDocument | null>(null);
  const [back, setBack] = useState<LocalDocument | null>(null);
  const [idType, setIdType] = useState<IdDocumentType>("NATIONAL_ID");
  // The NIN is cross-checked against the Tier 1 BVN at this tier.
  const [nin, setNin] = useState("");
  // Optional here. A utility bill evidences the address declared at Tier 1;
  // it is what Tier 3 checks, so giving it now lets that check reuse it.
  const [bill, setBill] = useState<LocalDocument | null>(null);
  const spec = documentSpec(idType);
  const backRequired = needsBack(idType);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reject unsupported types here (server allows JPEG/PNG/WEBP/PDF) to save a
  // round-trip, then shrink the photo before it ever reaches the upload.
  const pick = (set: (doc: LocalDocument) => void) => async (file: File) => {
    const picked = toLocalDocument(file);
    if (!isSupportedDocument(picked)) {
      setError("Unsupported file type. Choose a JPEG, PNG or WEBP image of your document.");
      return;
    }
    set(await compressDocument(picked));
    setError(null);
  };

  const onSubmit = async () => {
    // The bill is optional at Tier 2, so it is not part of this guard.
    if (!front || (backRequired && !back)) return;
    setError(null);
    setSubmitting(true);
    try {
      // Store the files, then attach the returned storage keys to the
      // submission. A failed upload and a rejected submission need different
      // advice, so they are tracked separately.
      let frontUp, backUp, billUp;
      try {
        [frontUp, backUp, billUp] = await Promise.all([
          uploadKycDocument(front),
          back ? uploadKycDocument(back) : Promise.resolve(undefined),
          bill ? uploadKycDocument(bill) : Promise.resolve(undefined),
        ]);
      } catch (uploadErr) {
        // Measure what we actually tried to send, so "too large" is a
        // diagnosis rather than a guess.
        const [frontBytes, backBytes, billBytes] = await Promise.all([
          fileSizeBytes(front.uri),
          back ? fileSizeBytes(back.uri) : Promise.resolve(null),
          bill ? fileSizeBytes(bill.uri) : Promise.resolve(null),
        ]);
        const sizes = [formatBytes(frontBytes), ...(back ? [formatBytes(backBytes)] : []), ...(bill ? [formatBytes(billBytes)] : [])].join(" + ");
        const oversized = [frontBytes, backBytes, billBytes].some((bytes) => bytes !== null && bytes > MAX_UPLOAD_BYTES);
        throw new Error(uploadFailureMessage(uploadErr, { subject: "Your photos", plural: true, sizes, oversized }));
      }
      await submitTier2({
        nin,
        idType,
        documentStorageKey: frontUp.storageKey,
        ...(backUp ? { documentBackStorageKey: backUp.storageKey } : {}),
        ...(billUp ? { utilityBillStorageKey: billUp.storageKey } : {}),
      });
      // Lands in REVIEW — the refetch swaps this form for the review notice.
      await queryClient.invalidateQueries({ queryKey: KYC_STATUS_KEY });
    } catch (err) {
      setError(friendlyErrorMessage(err, "Submission failed. Check your network and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const shownError = error ?? (summary.stage === "tier2-rejected" ? summary.rejectionReason : null);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        back={{ href: "/app/settings", label: "Settings" }}
        title="ID document"
        subtitle="Tier 2 unlocks larger daily volumes. Tell us which document you have, then photograph it clearly and in full frame."
      />

      {summary.stage === "loading" ? (
        <Card>
          <Loading />
        </Card>
      ) : summary.canSubmitTier2 ? (
        <Card className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Which document do you have?</p>
            <Choice
              wrap
              label="Which document do you have?"
              disabled={submitting}
              options={ID_DOCUMENTS.map((d) => ({ label: d.label, value: d.type }))}
              value={idType}
              onChange={(type) => {
                if (type === idType) return;
                setIdType(type);
                // Photos of the previous document do not belong to this one.
                setFront(null);
                setBack(null);
                setError(null);
              }}
            />
            <p className="text-sm text-muted">{spec.hint}</p>
          </div>

          <div className={backRequired ? "grid gap-5 sm:grid-cols-2" : "grid gap-5"}>
            <DocumentSlot label={spec.frontLabel} value={front} onFile={pick(setFront)} disabled={submitting} />
            {backRequired && <DocumentSlot label={spec.backLabel ?? "Back of document"} value={back} onFile={pick(setBack)} disabled={submitting} />}
          </div>

          <Input
            label="NIN"
            value={nin}
            onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
            inputMode="numeric"
            placeholder="11 digits"
            disabled={submitting}
            hint="Checked against the BVN you gave at Tier 1 — the two have to name the same person."
          />

          <div className="flex flex-col gap-2">
            <DocumentSlot label="Utility bill (optional)" value={bill} onFile={pick(setBill)} disabled={submitting} />
            <p className="text-sm text-muted">
              Optional: a recent utility bill showing the address you gave at Tier 1 — adding it now can speed up address verification (Tier 3)
              later.
            </p>
            {bill && (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setBill(null)} disabled={submitting}>
                Remove bill
              </Button>
            )}
          </div>

          {/* A declined document leaves the form up — say why before they retry. */}
          <Alert>{shownError}</Alert>
          <Button onClick={() => void onSubmit()} loading={submitting} disabled={!front || (backRequired && !back) || nin.length !== 11} block>
            Submit for review
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <StatusBody stage={summary.stage} />
        </Card>
      )}
    </div>
  );
}

// One capture slot: preview + camera / file actions.
function DocumentSlot({
  label,
  value,
  onFile,
  disabled,
}: {
  label: string;
  value: LocalDocument | null;
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
        {!value ? (
          <span className="text-sm text-muted">Not captured yet</span>
        ) : value.mimeType.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL
          <img src={value.uri} alt={label} className="size-full object-cover" />
        ) : (
          <span className="px-4 text-center text-sm">{value.name}</span>
        )}
      </div>
      <div className="flex gap-2">
        <FilePick variant="primary" accept={IMAGE_ACCEPT} capture="environment" onFile={onFile} disabled={disabled} className="flex-1">
          Use camera
        </FilePick>
        <FilePick onFile={onFile} disabled={disabled} className="flex-1">
          Choose photo
        </FilePick>
      </div>
    </div>
  );
}

// Every non-submittable state: Tier 1 outstanding, a review in flight, or done.
function StatusBody({ stage }: { stage: KycStage }) {
  if (stage === "verified") {
    return (
      <>
        <h2 className="font-display text-lg font-semibold text-success">Fully verified</h2>
        <p className="text-muted">Your document was approved. Tier 2 limits are active.</p>
      </>
    );
  }

  if (stage === "tier2-review") {
    return (
      <>
        <h2 className="font-display text-lg font-semibold text-warning">Under review</h2>
        <p className="text-muted">
          Your document is with our compliance team. We will notify you once the review is complete — there is nothing more to do here.
        </p>
      </>
    );
  }

  return (
    <>
      <h2 className="font-display text-lg font-semibold text-warning">Tier 1 required</h2>
      <p className="text-muted">
        {stage === "tier1-review"
          ? "Your identity check is still under review. Once it is approved you can submit a document here."
          : "Verify your identity first — Tier 2 builds on an approved Tier 1."}
      </p>
      {stage !== "tier1-review" && <ButtonLink href="/app/kyc-tier1">Verify identity</ButtonLink>}
    </>
  );
}
