// Invoices: the reason a business account is paying someone other than itself.
//
// An individual may only pay an account in their own name, so there is nothing
// for them to explain and nothing here applies. A business is exempt from that
// rule, and the invoice is what takes its place -- captured before the payment
// rather than reconstructed after it.
//
// Upload first, then send the returned id with the payment. Doing it in two
// steps means an abandoned payment leaves an unused invoice rather than a
// payment with no evidence behind it.
import { api, filePart } from "./api";
import type { LocalDocument } from "./kyc";

/** An invoice as the server reports it back. */
export interface Invoice {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  /** Decimal string -- money through a JS number stops adding up. */
  amount: string | null;
  currency: string | null;
  note: string | null;
  /** The payment this was attached to, or null while still unused. */
  usedByReference: string | null;
  createdAt: string;
}

/** What the form can say about an invoice beyond the document. All optional. */
export interface InvoiceDetails {
  supplierName?: string;
  invoiceNumber?: string;
  amount?: number;
  currency?: string;
  note?: string;
}

export async function uploadInvoice(
  doc: LocalDocument,
  details: InvoiceDetails = {},
): Promise<Invoice> {
  const form = new FormData();
  form.append(
    "file",
    filePart({ uri: doc.uri, name: doc.name, type: doc.mimeType, file: doc.file }),
    doc.name,
  );
  // Only the fields that were filled in. An empty string is not "no value" to
  // a multipart body -- it is a value, and it would be stored as one.
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined || value === null || value === "") continue;
    form.append(key, String(value));
  }
  const res = await api.upload<{ data: Invoice }>("/invoices", form);
  return res.data;
}
