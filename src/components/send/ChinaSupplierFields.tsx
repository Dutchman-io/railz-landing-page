"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { toLocalDocument, uploadFailureMessage, uploadKycDocument } from "@/lib/kyc";
import type { LogisticsTracking, SupportingDocument } from "@/lib/globalSend";
import { FilePickButton } from "./FilePickButton";

/** An uploaded document, with the name shown back to the sender. */
export interface UploadedSupportingDocument {
  storageKey: string;
  name: string;
}

/**
 * Everything China's payout partner needs beyond the recipient's name, bank
 * and account: China payouts are payments to a supplier, so they carry the
 * bank's CNAPS code, the recipient's name in Chinese and national ID, the
 * shipment, an invoice and a contract. The partner refuses one without any
 * of them, whatever the reason given.
 */
export interface ChinaSupplierDetails {
  cnaps: string;
  nameInChinese: string;
  nationalId: string;
  tracking: LogisticsTracking[];
  invoice: UploadedSupportingDocument | null;
  contract: UploadedSupportingDocument | null;
}

export const EMPTY_CHINA_DETAILS: ChinaSupplierDetails = {
  cnaps: "",
  nameInChinese: "",
  nationalId: "",
  tracking: [{ trackingNumber: "", carrierName: "" }],
  invoice: null,
  contract: null,
};

const CNAPS = /^\d{12}$/;
const CHINESE = /[一-鿿]/;
const CHINA_ID = /^\d{17}[\dXx]$/;

/** What is still missing, in the words the send screen lists. The server
 * checks the same before anything is debited. */
export const chinaMissing = (d: ChinaSupplierDetails): string[] =>
  [
    CNAPS.test(d.cnaps.trim()) ? "" : "bank's 12-digit CNAPS code",
    CHINESE.test(d.nameInChinese) ? "" : "recipient's name in Chinese",
    CHINA_ID.test(d.nationalId.trim()) ? "" : "recipient's 18-character ID number",
    d.tracking.some((t) => t.trackingNumber.trim() && t.carrierName.trim())
      ? ""
      : "a shipment tracking number and carrier",
    d.invoice ? "" : "invoice",
    d.contract ? "" : "contract",
  ].filter(Boolean);

/** The beneficiary fields this adds to a China send. */
export const chinaBeneficiaryFields = (d: ChinaSupplierDetails) => ({
  bankCode: d.cnaps.trim(),
  nameInLocalLanguage: d.nameInChinese.trim(),
  nationalIdNumber: d.nationalId.trim().toUpperCase(),
  logisticsTracking: d.tracking
    .filter((t) => t.trackingNumber.trim() && t.carrierName.trim())
    .map((t) => ({
      trackingNumber: t.trackingNumber.trim(),
      carrierName: t.carrierName.trim(),
    })),
  documents: [
    ...(d.invoice ? [{ type: "invoice", storageKey: d.invoice.storageKey } as const] : []),
    ...(d.contract ? [{ type: "contract", storageKey: d.contract.storageKey } as const] : []),
  ] satisfies SupportingDocument[],
});

const MAX_SHIPMENTS = 10;
const PHOTO_TYPES = "image/jpeg,image/png,image/webp";
const FILE_TYPES = "application/pdf,image/jpeg,image/png";

export function ChinaSupplierFields({
  value,
  onChange,
}: {
  value: ChinaSupplierDetails;
  onChange: (next: ChinaSupplierDetails) => void;
}) {
  const [uploading, setUploading] = useState<"invoice" | "contract" | null>(null);
  const [uploadError, setUploadError] = useState<{ title: string; message: string } | null>(null);
  const set = (patch: Partial<ChinaSupplierDetails>) => onChange({ ...value, ...patch });
  const setShipment = (index: number, patch: Partial<LogisticsTracking>) =>
    set({ tracking: value.tracking.map((t, i) => (i === index ? { ...t, ...patch } : t)) });

  // A photo of the paper, or the PDF already on the device: insisting on one
  // would make somebody retype it.
  const pick = async (kind: "invoice" | "contract", file: File) => {
    const doc = toLocalDocument(file);
    setUploading(kind);
    setUploadError(null);
    try {
      const uploaded = await uploadKycDocument(doc);
      set({ [kind]: { storageKey: uploaded.storageKey, name: doc.name } });
    } catch (err) {
      setUploadError({
        title: `Could not upload the ${kind}`,
        message: uploadFailureMessage(err, { subject: `Your ${kind}`, plural: false }),
      });
    } finally {
      setUploading(null);
      URL.revokeObjectURL(doc.uri);
    }
  };

  const documentRow = (kind: "invoice" | "contract", label: string) => {
    const doc = value[kind];
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">{label}</p>
        {doc ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <span className="truncate text-sm">{doc.name}</span>
            <button type="button" onClick={() => set({ [kind]: null })} className="text-sm text-danger">
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <FilePickButton
              accept={PHOTO_TYPES}
              loading={uploading === kind}
              disabled={uploading !== null}
              onFile={(f) => void pick(kind, f)}
            >
              Photo
            </FilePickButton>
            <FilePickButton accept={FILE_TYPES} disabled={uploading !== null} onFile={(f) => void pick(kind, f)}>
              PDF or file
            </FilePickButton>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Payments to China are payments to a supplier for goods. Our partner needs the details below, the invoice and
        the contract to pay one.
      </p>
      <Input
        label="Bank's CNAPS code"
        placeholder="12 digits, from the recipient's bank"
        inputMode="numeric"
        maxLength={12}
        value={value.cnaps}
        onChange={(e) => set({ cnaps: e.target.value })}
      />
      <Input
        label="Recipient's name in Chinese"
        placeholder="e.g. 李伟"
        value={value.nameInChinese}
        onChange={(e) => set({ nameInChinese: e.target.value })}
      />
      <Input
        label="Recipient's national ID number"
        placeholder="18 characters"
        autoCapitalize="characters"
        maxLength={18}
        value={value.nationalId}
        onChange={(e) => set({ nationalId: e.target.value })}
      />

      <p className="text-sm font-medium">Shipment</p>
      {value.tracking.map((shipment, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <Input
            label="Tracking number"
            placeholder="e.g. SF1234567890123"
            autoCapitalize="characters"
            value={shipment.trackingNumber}
            onChange={(e) => setShipment(index, { trackingNumber: e.target.value })}
          />
          <Input
            label="Carrier"
            placeholder="e.g. SF Express, DHL"
            value={shipment.carrierName}
            onChange={(e) => setShipment(index, { carrierName: e.target.value })}
          />
          {value.tracking.length > 1 && (
            <button
              type="button"
              onClick={() => set({ tracking: value.tracking.filter((_, i) => i !== index) })}
              className="w-fit text-sm text-danger"
            >
              Remove shipment
            </button>
          )}
        </div>
      ))}
      {value.tracking.length < MAX_SHIPMENTS && (
        <button
          type="button"
          onClick={() => set({ tracking: [...value.tracking, { trackingNumber: "", carrierName: "" }] })}
          className="w-fit text-sm font-medium text-primary"
        >
          + Add another shipment
        </button>
      )}

      {documentRow("invoice", "Invoice")}
      {documentRow("contract", "Contract")}
      {uploadError && (
        <Alert tone="danger">
          <strong className="block">{uploadError.title}</strong>
          {uploadError.message}
        </Alert>
      )}
    </div>
  );
}
