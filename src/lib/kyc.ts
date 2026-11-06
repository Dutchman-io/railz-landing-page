// KYC calls against the backend (PRD §4 "Tiered Verification").
//   Tier 1 — POST /kyc/tier1 with the BVN, biodata and a selfie; the server may
//            auto-approve, reject, or route to manual review.
//   Tier 2 — upload the files to POST /uploads/kyc-document first, then send
//            the returned storage keys with the NIN to POST /kyc/tier2.
//            Requires an approved Tier 1.
//   Tier 3 — a utility bill, checked against the Tier 1 address.
import { useQuery } from "@tanstack/react-query";
import {
  api,
  apiErrorStatus,
  filePart,
  friendlyErrorMessage,
  isTimeoutError,
} from "./api";
import { LOADING_SUMMARY, summarizeKyc } from "./kycSummary";
import {
  ApiEnvelope,
  KycRecord,
  KycSubmissionResult,
  Tier1KycRequest,
  Tier2KycRequest,
  UploadedDocument,
} from "@/types/api";

// A file chosen from the camera or photo library, normalised away from the
// picker's own shape so this module stays free of expo-image-picker types.
export interface LocalDocument {
  /** An object URL for previewing the file (URL.createObjectURL). */
  uri: string;
  name: string;
  mimeType: string;
  /** The file itself, as the browser's file input or camera produced it. */
  file: Blob;
}

// Server-side allow-list (uploads.controller.ts), checked there by the file's
// actual bytes rather than its name. Anything else (HEIC included) is a 400.
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  heic: "image/heic", // rejected by the server — surfaced early by isSupportedDocument
  heif: "image/heif",
};

const extensionOf = (path: string): string => {
  const withoutQuery = path.split("?")[0];
  const lastDot = withoutQuery.lastIndexOf(".");
  return lastDot === -1 ? "" : withoutQuery.slice(lastDot + 1).toLowerCase();
};

/**
 * Turn a file from an <input type="file"> (or a captured camera frame) into
 * an uploadable document. Browsers sometimes leave `type` empty, so fall back
 * to the file extension and finally to JPEG.
 */
export const toLocalDocument = (file: File): LocalDocument => {
  const name = file.name || "document.jpg";
  const mimeType =
    file.type || EXTENSION_MIME[extensionOf(name)] || "image/jpeg";
  return { uri: URL.createObjectURL(file), name, mimeType, file };
};

export const isSupportedDocument = (doc: LocalDocument): boolean =>
  ALLOWED_MIME.includes(doc.mimeType);

/** Above this the upload is likely to be refused or to stall on cellular. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * A readable sentence for a failed POST /uploads/kyc-document.
 *
 * Never the raw transport text ("Network request failed" says nothing to the
 * person holding the phone). `subject` names what was being sent, e.g.
 * "Your photos" / "Your bill"; `sizes` (formatted) is appended where it helps.
 */
export const uploadFailureMessage = (
  err: unknown,
  {
    subject,
    plural,
    sizes,
    oversized = false,
  }: { subject: string; plural: boolean; sizes?: string; oversized?: boolean },
): string => {
  const status = apiErrorStatus(err);
  const suffix = sizes ? ` (${sizes})` : "";
  if (status === 413 || oversized) {
    return (
      `${subject} ${plural ? "are" : "is"} too large${suffix}. Retake ` +
      `${plural ? "them" : "it"}, or pick a smaller image, and try again.`
    );
  }
  if (isTimeoutError(err)) return err.message;
  if (status === undefined) {
    return (
      `We couldn't upload ${subject.toLowerCase()}${suffix}. Check your ` +
      "connection and try again."
    );
  }
  if (status === 400) {
    return "That file can't be used. Choose a JPEG, PNG or WEBP photo and try again.";
  }
  if (status === 429) {
    return "Too many uploads in a short time. Wait a moment and try again.";
  }
  if (status >= 500) {
    return "We couldn't save your upload just now. Please try again in a moment.";
  }
  // Anything else (e.g. an expired session) carries its own readable message.
  return friendlyErrorMessage(err, "Upload failed. Please try again.");
};

const unwrap = <T>(response: ApiEnvelope<T>): T => {
  if (response.data === undefined) {
    throw new Error(
      response.message || "The server returned an empty response.",
    );
  }
  return response.data;
};

export const submitTier1 = async (
  payload: Tier1KycRequest,
): Promise<KycSubmissionResult> => {
  const response = await api.post<ApiEnvelope<KycSubmissionResult>>(
    "/kyc/tier1",
    payload,
  );
  return unwrap(response);
};

export const uploadKycDocument = async (
  doc: LocalDocument,
): Promise<UploadedDocument> => {
  const form = new FormData();
  form.append(
    "file",
    filePart({ uri: doc.uri, name: doc.name, type: doc.mimeType, file: doc.file }),
    doc.name,
  );
  // Unwrapped — the uploads controller returns the payload without an envelope.
  return api.upload<UploadedDocument>("/uploads/kyc-document", form);
};

/** What the server made of a selfie, and what to change about it. */
export interface SelfieCheck {
  ran: boolean;
  live: boolean | null;
  probability: number | null;
  faceDetected: boolean | null;
  multipleFaces: boolean | null;
  note: string | null;
  /** Empty means nothing to fix. */
  guidance: string[];
}

/**
 * Check a selfie the moment it is taken.
 *
 * Advisory only. A submission is never blocked on this — the point is that
 * someone can retake a dark photo now instead of a reviewer refusing it days
 * later.
 */
export const checkSelfie = async (
  /** `storageKey` from POST /uploads/kyc-document. */
  selfieStorageKey: string,
): Promise<SelfieCheck | null> => {
  try {
    const res = await api.post<ApiEnvelope<SelfieCheck>>(
      "/kyc/selfie-check",
      { selfieStorageKey },
      { retry: false },
    );
    return unwrap(res);
  } catch {
    // The photo is already taken and uploaded. A failed check must not look
    // like a failed capture.
    return null;
  }
};

export const submitTier2 = async (
  payload: Tier2KycRequest,
): Promise<KycSubmissionResult> => {
  const response = await api.post<ApiEnvelope<KycSubmissionResult>>(
    "/kyc/tier2",
    payload,
  );
  return unwrap(response);
};

/**
 * The caller's own KYC records, newest first. The controller returns the rows
 * bare, but we unwrap a `data` envelope defensively and always hand back an
 * array — every consumer below assumes one.
 */
export const getKycStatus = async (): Promise<KycRecord[]> => {
  const res = await api.get<unknown>("/kyc/status");
  if (Array.isArray(res)) return res as KycRecord[];
  const nested = (res as { data?: unknown })?.data;
  return Array.isArray(nested) ? (nested as KycRecord[]) : [];
};

export interface KycProfile {
  dateOfBirth: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  subdivision: string | null;
  postalCode: string | null;
}

export const getKycProfile = async (): Promise<KycProfile | null> => {
  const res = await api.get<{
    kycDateOfBirth: string;
    kycAddressLine1: string;
    kycAddressLine2: string | null;
    kycCity: string;
    kycSubdivision: string | null;
    kycPostalCode: string | null;
  } | null>("/kyc/profile");
  if (!res) return null;
  return {
    dateOfBirth: res.kycDateOfBirth,
    addressLine1: res.kycAddressLine1,
    addressLine2: res.kycAddressLine2,
    city: res.kycCity,
    subdivision: res.kycSubdivision,
    postalCode: res.kycPostalCode,
  };
};

export const KYC_PROFILE_KEY = ["kyc-profile"] as const;

export function useKycProfile() {
  return useQuery({
    queryKey: KYC_PROFILE_KEY,
    queryFn: getKycProfile,
    staleTime: 60_000,
  });
}

/**
 * International verification — NOT KYC Tier 3 (that is the address check
 * below). Our partner abroad onboards the customer in their own name before it
 * will move money to or from the corridors it covers; see lib/international.
 *
 * Date of birth and residential address come from the saved Tier 1 profile.
 * The identity document comes from the tier 2 record, so tier 2 must be
 * approved first.
 */
export interface Tier3Request {
  /** A country the customer wants to send to or receive from — decides which
   * partner this submission onboards them with. */
  destinationCountry: string;
  dateOfBirth: string; // yyyy-mm-dd
  addressLine1: string;
  addressLine2?: string;
  city: string;
  /** State or province. Required for US addresses. */
  subdivision?: string;
  postalCode?: string;
}

/**
 * Submit it. Resolves once the partner has the details; read the outcome from
 * GET /global-send/international-status afterwards, not from this response —
 * its list of verdicts is not scoped to the partners that enrol senders, so
 * an unrelated approval on it would read as this one.
 */
/** An address abroad or at home; country is ISO alpha-2. */
export interface BusinessAddress {
  streetLine1: string;
  streetLine2?: string;
  city: string;
  subdivision?: string;
  postalCode?: string;
  country: string;
}

/** An owner (25%+) or a person who controls the business. */
export interface BusinessPerson {
  firstName: string;
  lastName: string;
  email: string;
  birthDate: string; // yyyy-mm-dd
  address: BusinessAddress;
  idType: "passport" | "national_id" | "drivers_license";
  idNumber: string;
  idIssuingCountry: string;
  /** From POST /uploads/kyc-document. */
  idFrontStorageKey: string;
  idBackStorageKey?: string;
  hasOwnership: boolean;
  hasControl: boolean;
  isSigner: boolean;
  title?: string;
}

/** What a business sends for international verification. Its registered
 * name, number and address are already on file from signup. */
export interface BusinessVerification {
  businessType: string;
  description: string;
  accountPurpose: string;
  accountPurposeOther?: string;
  sourceOfFunds: string;
  formationDocumentStorageKey: string;
  ownershipDocumentStorageKey?: string;
  natureOfBusinessDocumentStorageKey?: string;
  attestOwnershipStructure?: boolean;
  associatedPersons: BusinessPerson[];
}

export interface BusinessTier3Request {
  destinationCountry: string;
  business: BusinessVerification;
}

export const submitTier3 = async (payload: Tier3Request | BusinessTier3Request): Promise<void> => {
  await api.post<ApiEnvelope<unknown>>(
    "/global-send/verification",
    payload,
    // A create against a partner: a blind retry could enrol twice.
    { retry: false },
  );
};

// ---------------------------------------------------------------- Tier 3
//
// A utility bill, read and compared with the address declared at Tier 1. This
// replaced a check that asked the device for its position overnight, which
// Google refused -- background location has to be core to an app, and raising
// a transfer limit is not.

/** The bill already held from Tier 2, which this check can reuse. */
export interface BillOnFile {
  /** Legacy reference; not needed to submit. */
  utilityBillUrl?: string | null;
  /** What a submission needs. Absent on very old records -- ask for a new bill. */
  utilityBillStorageKey?: string | null;
}

export interface AddressVerification {
  status: "NOT_STARTED" | "PENDING" | "REVIEW" | "APPROVED" | "REJECTED";
  /** MATCH, MISMATCH or UNREADABLE once a bill has been read. */
  verdict: string | null;
  reason: string | null;
  /** Null means there is nothing to reuse -- ask for a bill. */
  billOnFile: BillOnFile | null;
}

/**
 * The verdict on a submitted bill, straight from the check: APPROVED on a
 * clean address match, REVIEW while our team looks at it, or REJECTED. A bill
 * that cannot be used at all is a 400 asking for a new one instead.
 */
export interface AddressVerificationSubmission {
  status: "PENDING" | "REVIEW" | "APPROVED" | "REJECTED";
  /** MATCH, MISMATCH or UNREADABLE. */
  verdict: string | null;
  /** Free-form detail; only shown when it is a plain sentence. */
  reason: unknown;
}

export interface AddressBillRequest {
  /** `storageKey` from POST /uploads/kyc-document. */
  utilityBillStorageKey: string;
}

export const ADDRESS_VERIFICATION_KEY = ["kyc-address-verification"] as const;

export const getAddressVerification = async (): Promise<AddressVerification> =>
  unwrap(
    await api.get<ApiEnvelope<AddressVerification>>(
      "/kyc/address-verification",
    ),
  );

/**
 * Send the bill.
 *
 * `retry: false` -- this opens a Tier 3 record, and a blind retry of something
 * that may have succeeded would put a second one in front of a reviewer.
 */
export const submitAddressBill = async (
  bill: AddressBillRequest,
): Promise<AddressVerificationSubmission> =>
  unwrap(
    await api.post<ApiEnvelope<AddressVerificationSubmission>>(
      "/kyc/address-verification",
      bill,
      { retry: false },
    ),
  );

export function useAddressVerification() {
  return useQuery({
    queryKey: ADDRESS_VERIFICATION_KEY,
    queryFn: getAddressVerification,
    staleTime: 15_000,
  });
}

export const KYC_STATUS_KEY = ["kyc-status"];

// Stage derivation lives in kycSummary.ts (no transport imports, so it stays
// testable on its own); re-exported here so screens have a single import site.
export { summarizeKyc, LOADING_SUMMARY };
export type { KycStage, KycSummary } from "./kycSummary";

/**
 * KYC state for any screen that gates on verification. Refetches on mount so
 * returning from a submission shows the updated stage; submissions themselves
 * invalidate KYC_STATUS_KEY for an immediate flip.
 */
export function useKycSummary() {
  const query = useQuery({
    queryKey: KYC_STATUS_KEY,
    queryFn: getKycStatus,
    staleTime: 30_000,
    // A reviewer's decision lands server-side with nothing to notify the device,
    // and the tabs stay mounted, so without this the screen can sit on "under
    // review" indefinitely. Poll only while a decision is actually outstanding.
    refetchInterval: (q) => {
      const data = q.state.data;
      return data && summarizeKyc(data).awaitingReview ? 15_000 : false;
    },
  });

  return {
    // Until the first load resolves we report 'loading' rather than 'unstarted',
    // so a submitted user never sees the form flash back up.
    summary: query.data ? summarizeKyc(query.data) : LOADING_SUMMARY,
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

export const REVERIFICATION_KEY = ["kyc-reverification"] as const;

export type ReverificationItem =
  "BVN" | "NIN" | "COUNTRY" | "ID_DOCUMENT" | "ADDRESS_PROOF";

export interface ReverificationRequest {
  items: ReverificationItem[];
  message: string | null;
}

// An admin's open request for the user to re-verify specific items, or null.
export function useReverification() {
  return useQuery<ReverificationRequest | null>({
    queryKey: REVERIFICATION_KEY,
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<ReverificationRequest | null>>(
        "/kyc/reverification",
      );
      return res.data ?? null;
    },
    staleTime: 30_000,
  });
}
