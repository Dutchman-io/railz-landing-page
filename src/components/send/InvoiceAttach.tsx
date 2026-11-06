"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { friendlyErrorMessage } from "@/lib/api";
import { uploadInvoice } from "@/lib/invoices";
import { toLocalDocument } from "@/lib/kyc";
import { FilePickButton } from "./FilePickButton";

export interface AttachedInvoice {
  id: string;
  name: string;
}

/**
 * The invoice a business payment to someone else is for. A photo of paper or
 * a file already on the device: insisting on one or the other would make
 * somebody retype it.
 */
export function InvoiceAttach({
  invoice,
  onChange,
}: {
  invoice: AttachedInvoice | null;
  onChange: (invoice: AttachedInvoice | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attach = async (file: File) => {
    const doc = toLocalDocument(file);
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadInvoice(doc);
      onChange({ id: uploaded.id, name: uploaded.fileName ?? "Invoice" });
    } catch (err) {
      setError(friendlyErrorMessage(err, "Please try again."));
    } finally {
      setUploading(false);
      URL.revokeObjectURL(doc.uri);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
      <p className="text-xs font-semibold tracking-widest text-muted">INVOICE</p>
      <p className="text-sm text-muted">
        {invoice ? "Attached. It is filed with the payment." : "A business payment needs the invoice it is for."}
      </p>
      {invoice ? (
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium">{invoice.name}</span>
          <button type="button" onClick={() => onChange(null)} className="text-sm font-medium text-primary">
            Replace
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <FilePickButton
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            variant="ghost"
            loading={uploading}
            onFile={(f) => void attach(f)}
          >
            Photograph
          </FilePickButton>
          <FilePickButton
            accept="application/pdf,image/jpeg,image/png,image/webp"
            variant="ghost"
            loading={uploading}
            onFile={(f) => void attach(f)}
          >
            Choose a file
          </FilePickButton>
        </div>
      )}
      {error && (
        <Alert tone="danger">
          <strong className="block">Could not upload the invoice</strong>
          {error}
        </Alert>
      )}
    </div>
  );
}
