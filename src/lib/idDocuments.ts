import { IdDocumentType } from "@/types/api";

/**
 * The documents a user can verify with, and what each needs photographed.
 *
 * A passport is verified from its data page alone. Asking for the back of one
 * invites a photo of a blank page, which a reviewer then has to reject — so the
 * form asks for what the document actually has.
 */
export const ID_DOCUMENTS: {
  type: IdDocumentType;
  label: string;
  frontLabel: string;
  backLabel?: string;
  hint: string;
}[] = [
  {
    type: "NATIONAL_ID",
    label: "National ID (NIN)",
    frontLabel: "Front of your ID card",
    backLabel: "Back of your ID card",
    hint: "Your NIMC card or NIN slip.",
  },
  {
    type: "DRIVERS_LICENSE",
    label: "Driver's licence",
    frontLabel: "Front of your licence",
    backLabel: "Back of your licence",
    hint: "Must still be valid — an expired licence is rejected.",
  },
  {
    type: "PASSPORT",
    label: "International passport",
    frontLabel: "Photo page of your passport",
    hint: "The page with your photo and details. No second photo needed.",
  },
  {
    type: "VOTERS_CARD",
    label: "Voter's card",
    frontLabel: "Front of your voter's card",
    backLabel: "Back of your voter's card",
    hint: "Your PVC, both sides.",
  },
];

export const documentSpec = (type: IdDocumentType) =>
  ID_DOCUMENTS.find((d) => d.type === type) ?? ID_DOCUMENTS[0];

/** Whether this document has a reverse worth photographing. */
export const needsBack = (type: IdDocumentType): boolean =>
  documentSpec(type).backLabel !== undefined;
