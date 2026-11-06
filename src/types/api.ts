export type UserType = 'USER' | 'BUSINESS' | 'ADMIN';

/**
 * Chosen at signup and fixed after. A business verifies against a company
 * register rather than a person, and is the kind of account allowed to pay
 * someone other than itself -- against an invoice.
 */
export type AccountType = 'INDIVIDUAL' | 'BUSINESS';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  userType: UserType;
  /** Absent on a server that predates business accounts; treat as INDIVIDUAL. */
  accountType?: AccountType;
  verifiedAt: string | null;
  country?: string | null;
  createdAt?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SignInResponse {
  message: string;
  data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  };
}

export interface CreateUserResponse {
  message: string;
  data: {
    user: AuthUser;
  } & Partial<AuthTokens>;
}

export type KycLevel = 'TIER_1' | 'TIER_2';
export type KycStatus = 'PENDING' | 'REVIEW' | 'APPROVED' | 'REJECTED';

// Controllers that return SuccessResponse serialize to this envelope; the raw
// handlers (GET /kyc/status, POST /uploads/*) return their payload unwrapped.
export interface ApiEnvelope<T> {
  status: number;
  message: string;
  data?: T;
}

/**
 * Tier 1 under CBN's tiered KYC framework.
 *
 * The NIN moved to Tier 2: Tier 1 is the BVN check plus the biodata the
 * framework requires, and the selfie is what makes it a biometric check rather
 * than a photo upload — it is matched against the photo NIBSS holds for the BVN.
 */
export interface Tier1KycRequest {
  /** Exactly 11 digits. */
  bvn: string;
  /** yyyy-mm-dd. Matched against the date of birth NIBSS holds for the BVN. */
  dateOfBirth: string;
  occupation: string;
  /** Declared residential address. Evidenced at Tier 2, confirmed at Tier 3. */
  addressLine1: string;
  addressLine2?: string;
  city: string;
  /** State. */
  subdivision: string;
  postalCode?: string;
  /**
   * Required, and deliberately not defaulted: an unanswered declaration is
   * missing evidence, not an answer of "no".
   */
  isPoliticallyExposed: boolean;
  /** `storageKey` from POST /uploads/kyc-document. */
  selfieStorageKey: string;
}

/**
 * The document a user photographs for Tier 2. Values match what the payout
 * providers expect, so the backend can forward them when onboarding a sender.
 */
export type IdDocumentType =
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'NATIONAL_ID'
  | 'VOTERS_CARD';

/**
 * Every file is referenced by the `storageKey` from POST /uploads/kyc-document.
 * The older `documentUrl` / `documentBackUrl` / `utilityBillUrl` fields are
 * still accepted by the server for old builds, but this app no longer sends them.
 */
export interface Tier2KycRequest {
  /** Exactly 11 digits. Cross-checked against the BVN from Tier 1. */
  nin: string;
  idType: IdDocumentType;
  /** FRONT, or the data page of a passport. */
  documentStorageKey: string;
  /** Omitted for a passport, which is verified from its data page alone. */
  documentBackStorageKey?: string;
  /**
   * Optional at Tier 2. A bill evidencing the address declared at Tier 1; when
   * given now it can be reused for the Tier 3 address check.
   */
  utilityBillStorageKey?: string;
  /** The number printed on the document, when the user supplies it. */
  idNumber?: string;
}

// A row of the kyc_records table. `level` is numeric server-side (1, 2, 3) —
// KycLevel above describes the tier a screen is collecting, not this field.
export interface KycRecord {
  id: string;
  userId: string;
  level: number;
  status: KycStatus;
  idType: string | null;
  idNumber: string | null;
  documentUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

/** What one of the two numbers did, as the server reports it back. */
export interface Tier1FieldResult {
  /** ok: verified. not_found: no such record. name_mismatch: someone else's. */
  outcome: 'ok' | 'not_found' | 'name_mismatch';
  message: string | null;
}

export interface KycSubmissionResult {
  status: KycStatus;
  /** Tier 1: only the selfie failed. Take a new one and submit again. */
  retakeSelfie?: boolean;
  /**
   * The record the submission produced. Can be null in edge cases (e.g. the
   * check could not be completed), so read it defensively.
   */
  kyc: KycRecord | null;
  /** Same record under the newer name; may also be null or absent. */
  record?: KycRecord | null;
  /**
   * Per-number results, so a customer who mistyped one digit is sent back to
   * that field instead of re-entering both. Absent on servers that predate it.
   */
  fields?: { bvn: Tier1FieldResult; nin: Tier1FieldResult };
}

/**
 * POST /uploads/kyc-document. The `filename`/`size`/`mimetype` fields are only
 * present once a verification profile exists (before Tier 1 the server holds
 * the file alone).
 */
export interface UploadedDocument {
  /**
   * The verification provider's reference once a profile exists, otherwise
   * the same value as `storageKey`. Only legacy request fields carried it;
   * new requests send `storageKey`.
   */
  url: string;
  /**
   * Always our own copy's key. What every `*StorageKey` request field carries
   * (selfie, ID document front/back, utility bill).
   */
  storageKey: string;
  /** Same value as `storageKey`; kept by the server for older app builds. */
  key?: string;
  retainedBy?: 'zemfi' | 'both';
  filename?: string;
  size?: number;
  mimetype?: string;
}

export interface WalletBalance {
  currency: string;
  balance: number;
}

export type BlockchainNetwork =
  | 'ethereum'
  | 'polygon'
  | 'arbitrum'
  | 'base'
  | 'arc'
  | 'bsc'
  | 'tron';

// Response shape of GET /rate. Rates are the quoted price — the platform
// spread is applied server-side and never returned (it is part of the price,
// not a fee). Fees are separate figures, never folded into these rates: the
// exchange fee below (sells only), and ZemFi's own fee, which only a locked
// quote carries.
//
// This used to also declare `payoutFeeBps` and `networkGasFeeUsd`. The route
// has never returned either, so both were always undefined at runtime and the
// fee arithmetic built on them always came out as zero. Declaring a field the
// API does not send is worse than not having it: it reads as working code.
export interface RateSnapshot {
  // The stablecoin these rates price. Absent from servers that predate it.
  asset?: string;
  // The user's local fiat (derived server-side from their country), e.g. NGN/GHS.
  fiatCurrency: string;
  buyRate: number; // local fiat per unit of the asset when buying
  sellRate: number; // local fiat per unit of the asset when selling
  // The exchange's fixed execution fee, in units of the asset. `exchangeFeeUsdt`
  // is the same number under its older name, still sent for older clients.
  exchangeFeeAsset?: number;
  exchangeFeeUsdt?: number;
}

// Response shape of the buy/sell quote routes. `rate` is the quoted rate --
// the platform spread is already applied server-side and is never returned.
// Every fee is its own field, and `destinationAmount` is net of all of them:
//   sell: destinationAmount = sourceAmount * rate - exchangeFee - partnerFee
//   buy:  destinationAmount = (sourceAmount - partnerFee) / rate
//
// This used to also declare `payoutFee`, `networkGasFee` and `network`. The
// route returns none of them (its fields are exactly the ones below), so they
// were always undefined, and nothing read them.
export interface Quote {
  id: string;
  sourceAmount: number;
  sourceCurrency: string;
  destinationAmount: number;
  destinationCurrency: string;
  rate: number;
  /** The exchange's fixed execution fee, in the fiat (the destination
   * currency of a sell); 0 on a buy. */
  exchangeFee: number;
  /** ZemFi's own fee, in the fiat; 0 when none applies. Optional only so a
   * server that predates it still parses. */
  partnerFee?: number;
  /** Seconds until the locked price can no longer be executed. */
  expiresIn: number;
}

// ------------------------------------------------------ Reason for payment

/**
 * Why a cross-border send is being made. Required on every cross-border
 * corridor; never asked on a withdrawal to the sender's own bank at home.
 * OTHER needs a `purposeNote` of 3-140 characters.
 */
export const PAYMENT_PURPOSES = [
  'FAMILY_SUPPORT',
  'EDUCATION',
  'MEDICAL',
  'GOODS_PAYMENT',
  'SERVICES_PAYMENT',
  'SALARY',
  'TRAVEL',
  'RENT_PROPERTY',
  'GIFT',
  'OWN_ACCOUNT_TRANSFER',
  'OTHER',
] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

// A Nigerian bank as returned by /bank/list. `code` is the NUBAN bank code we send
// back on lookup/save (PRD SCR-004).
export interface Bank {
  code: string;
  name: string;
}

// ---------------------------------------------------------------- Tier 3

/** Why a reading was not counted. None of these count against the customer
 * except `mocked`, which is the one thing here that shows intent. */
export interface LocationDiscarded {
  mocked?: number;
  noStreet?: number;
  tooImprecise?: number;
  differentStreet?: number;
}

export interface LocationEvidence {
  matching: number;
  matchingOvernight: number;
  daysCovered: number;
  discarded: LocationDiscarded;
}

/**
 * SUFFICIENT: enough to put in front of a reviewer.
 * INSUFFICIENT: more readings needed.
 * SUSPECT: a reading came from a simulated position — a person has to look.
 */
export type LocationVerdict = 'SUFFICIENT' | 'INSUFFICIENT' | 'SUSPECT';
