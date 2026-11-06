"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Loading } from "@/components/ui/Spinner";
import { FilePick } from "@/components/kyc/FilePick";
import { friendlyErrorMessage } from "@/lib/api";
import { compressDocument, fileSizeBytes, formatBytes } from "@/lib/compressImage";
import {
  ADDRESS_VERIFICATION_KEY,
  KYC_STATUS_KEY,
  MAX_UPLOAD_BYTES,
  isSupportedDocument,
  submitAddressBill,
  toLocalDocument,
  type AddressVerificationSubmission,
  uploadFailureMessage,
  uploadKycDocument,
  useAddressVerification,
  useKycSummary,
} from "@/lib/kyc";

/** A reason worth showing: a plain sentence, never a structured payload. */
const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

/**
 * Tier 3: confirming the customer lives where they said.
 *
 * A bill was already given at Tier 2, so the default is to confirm THAT one.
 * Uploading a different bill stays one click away, and is the only path when
 * none is held or the last one was turned down. Only open once Tier 2 is
 * approved -- the server refuses it before then.
 */
export default function KycAddressPage() {
  const queryClient = useQueryClient();
  const { summary } = useKycSummary();
  const { data, isLoading } = useAddressVerification();

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A freshly chosen bill, which replaces the one on file for this submission.
  const [newBillStorageKey, setNewBillStorageKey] = useState<string | null>(null);
  const [choosingNew, setChoosingNew] = useState(false);
  // The verdict on the bill just sent, shown at once.
  const [outcome, setOutcome] = useState<AddressVerificationSubmission | null>(null);
  // Set when the customer chooses to send another bill after a rejection.
  const [retrying, setRetrying] = useState(false);

  const onFile = data?.billOnFile ?? null;
  const status = outcome?.status ?? data?.status ?? "NOT_STARTED";
  const reason = textOf(outcome ? outcome.reason : data?.reason);

  // Already decided or waiting on a person: nothing to submit.
  const settled = status === "APPROVED" || status === "REVIEW" || status === "PENDING";
  const rejected = status === "REJECTED" && !retrying;

  const pickBill = async (file: File) => {
    setError(null);
    const doc = toLocalDocument(file);
    if (!isSupportedDocument(doc)) {
      setError("That file type is not supported. Use a JPEG, PNG or WEBP photo of your bill.");
      return;
    }

    setUploading(true);
    let compressed = doc;
    try {
      compressed = await compressDocument(doc);
      const uploaded = await uploadKycDocument(compressed);
      setNewBillStorageKey(uploaded.storageKey);
    } catch (err) {
      const bytes = await fileSizeBytes(compressed.uri);
      setError(
        uploadFailureMessage(err, {
          subject: "Your bill",
          plural: false,
          sizes: formatBytes(bytes),
          oversized: bytes !== null && bytes > MAX_UPLOAD_BYTES,
        }),
      );
    } finally {
      setUploading(false);
    }
  };

  const submit = async (utilityBillStorageKey: string | null | undefined) => {
    if (!utilityBillStorageKey) {
      setError("Please upload a new bill and send it again.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await submitAddressBill({ utilityBillStorageKey });
      setOutcome(result);
      setRetrying(false);
      setNewBillStorageKey(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADDRESS_VERIFICATION_KEY }),
        queryClient.invalidateQueries({ queryKey: KYC_STATUS_KEY }),
      ]);
    } catch (err) {
      // The server's own words say why the bill could not be used.
      setError(friendlyErrorMessage(err, "Could not submit that bill."));
    } finally {
      setSubmitting(false);
    }
  };

  const frame = (children: ReactNode) => (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: "/app/settings", label: "Settings" }} title="Address" />
      {children}
    </div>
  );
  const heading = (text: string) => <h2 className="font-display text-lg font-semibold">{text}</h2>;

  if (isLoading || summary.stage === "loading") return frame(<Loading />);

  // Tier 3 builds on an approved Tier 2.
  if (summary.approvedTier < 2) {
    return frame(
      <Card className="flex flex-col gap-4">
        {heading("Tier 2 required")}
        <p className="text-muted">
          {summary.stage === "tier2-review"
            ? "Your ID document is still under review. Once it is approved you can confirm your address here."
            : "Your ID document (Tier 2) must be approved before you can confirm your address."}
        </p>
        {summary.stage !== "tier2-review" && <ButtonLink href="/app/kyc-tier2">Go to Tier 2</ButtonLink>}
      </Card>,
    );
  }

  if (settled) {
    return frame(
      <Card className="flex flex-col gap-4">
        {heading(status === "APPROVED" ? "Address confirmed" : "In review")}
        <p className="text-muted">
          {status === "APPROVED"
            ? "Your address matched the bill you sent."
            : "Our team is reviewing your document, usually within one business day. We'll let you know as soon as it's done."}
        </p>
      </Card>,
    );
  }

  if (rejected) {
    return frame(
      <Card className="flex flex-col gap-4">
        {heading("We couldn't confirm your address")}
        <p className="text-muted">{reason ?? "The bill you sent did not confirm the address on your account."}</p>
        <p className="text-sm text-muted">Send a utility bill dated within the last 3 months that shows your name and the address on your account.</p>
        <Button
          onClick={() => {
            setRetrying(true);
            setOutcome(null);
            setNewBillStorageKey(null);
            setChoosingNew(true);
            setError(null);
          }}
        >
          Send another bill
        </Button>
      </Card>,
    );
  }

  return frame(
    <div className="flex flex-col gap-4">
      {onFile && !choosingNew ? (
        <Card className="flex flex-col gap-4">
          {heading("Use the bill you already sent")}
          <p className="text-muted">It must be dated within the last 3 months. We compare its address with the one on your account.</p>
          <Button onClick={() => void submit(onFile.utilityBillStorageKey)} loading={submitting} disabled={submitting || !onFile.utilityBillStorageKey}>
            Use this bill
          </Button>
          {!onFile.utilityBillStorageKey && <p className="text-sm text-muted">Please upload a new bill to continue.</p>}
          <Button variant="secondary" onClick={() => setChoosingNew(true)} disabled={submitting}>
            Upload a different bill
          </Button>
          <p className="text-sm text-muted">Use a bill dated within the last 3 months. We may ask for a more recent one.</p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          {heading("Send a utility bill")}
          <p className="text-muted">A bill dated within the last 3 months, showing your name and address. We compare its address with your account.</p>
          <FilePick onFile={(file) => void pickBill(file)} loading={uploading} disabled={uploading || submitting}>
            {newBillStorageKey ? "Bill selected — choose another" : "Choose bill"}
          </FilePick>
          <Button onClick={() => void submit(newBillStorageKey)} loading={submitting} disabled={!newBillStorageKey || submitting}>
            Submit
          </Button>
          {onFile && (
            <Button variant="secondary" onClick={() => setChoosingNew(false)} disabled={submitting}>
              Use the bill I already sent
            </Button>
          )}
        </Card>
      )}
      <Alert>{error}</Alert>
    </div>,
  );
}
