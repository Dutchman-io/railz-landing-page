// Pure derivation of KYC state from the records the server returns. Kept free
// of transport and React imports so it can be reasoned about — and tested —
// without pulling in expo or react-native.
import { KycRecord, KycStatus } from '@/types/api';

// Where the user is in the tier ladder. One value drives every screen, so the
// dashboard, settings and the two KYC screens can never disagree.
export type KycStage =
  | 'loading' // status not fetched yet — show nothing rather than the wrong thing
  | 'unstarted' // no submission on record
  | 'tier1-review' // submitted, waiting on a decision — no form, no CTA
  | 'tier1-rejected' // declined; the user may try again
  | 'tier1-approved' // Tier 1 done, Tier 2 available
  | 'tier2-review'
  | 'tier2-rejected'
  | 'verified'; // Tier 2 approved

export interface KycSummary {
  stage: KycStage;
  /** Highest fully approved tier. */
  approvedTier: 0 | 1 | 2 | 3;
  /** True while a decision that could still change the tier is outstanding. */
  awaitingReview: boolean;
  canSubmitTier1: boolean;
  canSubmitTier2: boolean;
  /**
   * Whether the Tier 3 address check is open to them.
   *
   * Its own flag because Tier 3 is reached from the account screen, not from a
   * send: raising a DOMESTIC limit has nothing to do with a destination country.
   */
  canSubmitTier3: boolean;
  /** Tier 3's evidence is with a reviewer. */
  tier3Pending: boolean;
  /** Reason attached to the most recent rejection, if any. */
  rejectionReason: string | null;
  /**
   * Why Tier 3 was declined, when it was. Separate from `rejectionReason`,
   * which reports the newest rejection at ANY level — a Tier 1 reason on the
   * address screen would be worse than none.
   */
  tier3RejectionReason: string | null;
  /** The tier a reviewer is currently looking at, or 0. */
  pendingTier: 0 | 1 | 2 | 3;
  /** The tier whose latest submission was declined and can be retried, or 0. */
  rejectedTier: 0 | 1 | 2 | 3;
}

export const LOADING_SUMMARY: KycSummary = {
  stage: 'loading',
  approvedTier: 0,
  awaitingReview: false,
  canSubmitTier1: false,
  canSubmitTier2: false,
  canSubmitTier3: false,
  tier3Pending: false,
  rejectionReason: null,
  tier3RejectionReason: null,
  pendingTier: 0,
  rejectedTier: 0,
};

const isPending = (status: KycStatus): boolean =>
  status === 'PENDING' || status === 'REVIEW';

/**
 * The idType cross-border onboarding was once written under.
 *
 * It used LEVEL 3 but meant something else entirely: a payout provider will
 * transact for this customer, not that anyone confirmed where they live.
 * Counting it told the user they had ₦1,000,000 limits while the server
 * enforced ₦200,000 — the server excludes it, so this must too. Nothing writes
 * these any more, but rows created before that change are still on record.
 */
const PROVIDER_ONBOARDING_ID_TYPE = 'PROVIDER_CUSTOMER';

/** A record from the CBN tier ladder, as opposed to a provider's onboarding. */
const isCbnTier = (record: KycRecord): boolean =>
  record.idType !== PROVIDER_ONBOARDING_ID_TYPE;

// Level is numeric server-side: 1 is the BVN check, 2 the documents, 3 the
// address. The CBN filter matters at level 3 and nowhere else.
const isTier1 = (record: KycRecord): boolean =>
  record.level === 1 && isCbnTier(record);
const isTier2 = (record: KycRecord): boolean =>
  record.level >= 2 && isCbnTier(record);
/** Tier 3 is the address check: a utility bill compared with the Tier 1 address. */
const isTier3 = (record: KycRecord): boolean =>
  record.level >= 3 && isCbnTier(record);

interface LevelState {
  tier1Approved: boolean;
  tier2Approved: boolean;
  tier1Pending: boolean;
  tier2Pending: boolean;
  tier3Pending: boolean;
  tier1Rejected: boolean;
  tier2Rejected: boolean;
}

const stageOf = (s: LevelState): KycStage => {
  if (s.tier2Approved) return 'verified';
  if (s.tier2Pending) return 'tier2-review';
  if (s.tier2Rejected) return 'tier2-rejected';
  if (s.tier1Approved) return 'tier1-approved';
  if (s.tier1Pending) return 'tier1-review';
  if (s.tier1Rejected) return 'tier1-rejected';
  return 'unstarted';
};

/**
 * Collapse the record list into the one shape the UI needs. Records arrive
 * newest-first, so the first match per level is the current one.
 *
 * The `canSubmit` flags mirror the server's own guards: it rejects a second
 * Tier 1 once approved, and a Tier 2 unless Tier 1 is approved and no other
 * Tier 2 is approved or in review. We additionally hide the Tier 1 form while a
 * submission is under review — resubmitting there is allowed but pointless.
 *
 * A level can hold both an approved record and a newer pending one: the server
 * only blocks a resubmission once the earlier one is APPROVED, so submitting
 * twice in quick succession leaves a duplicate behind that a reviewer may never
 * action. Approval therefore wins over a pending record at the same level —
 * otherwise a stale duplicate pins the UI on "under review" forever.
 */
export const summarizeKyc = (records: KycRecord[]): KycSummary => {
  const tier1 = records.find(isTier1) ?? null;
  const tier2 = records.find(isTier2) ?? null;
  // Separate from `tier2` above: isTier2 also matches a tier-3 record, so the
  // newest one found there can BE the tier-3 record — which then hides behind
  // an older, already-approved tier 2 (approval wins over pending, deliberately,
  // per the comment above). Tier 3's own pending state needs its own approved
  // flag so a stale tier-2 approval can't swallow a genuinely pending tier 3.
  const tier3 = records.find(isTier3) ?? null;
  const tier1Approved = records.some((r) => isTier1(r) && r.status === 'APPROVED');
  const tier2Approved = records.some((r) => isTier2(r) && r.status === 'APPROVED');
  const tier3Approved = records.some((r) => isTier3(r) && r.status === 'APPROVED');

  // Pending only counts when the level is not already approved — see above.
  const tier1Pending = !tier1Approved && tier1 !== null && isPending(tier1.status);
  const tier2Pending = !tier2Approved && tier2 !== null && isPending(tier2.status);
  const tier3Pending = !tier3Approved && tier3 !== null && isPending(tier3.status);

  const levels: LevelState = {
    tier1Approved,
    tier2Approved,
    tier1Pending,
    tier2Pending,
    tier3Pending,
    tier1Rejected: !tier1Approved && !tier1Pending && tier1?.status === 'REJECTED',
    tier2Rejected: !tier2Approved && !tier2Pending && tier2?.status === 'REJECTED',
  };

  const rejected = records.find((r) => r.status === 'REJECTED');
  const tier3Rejected =
    !tier3Approved && !tier3Pending && tier3?.status === 'REJECTED';
  const pendingTier = tier3Pending ? 3 : tier2Pending ? 2 : tier1Pending ? 1 : 0;
  const rejectedTier = levels.tier1Rejected
    ? 1
    : levels.tier2Rejected
      ? 2
      : tier3Rejected
        ? 3
        : 0;

  return {
    stage: stageOf(levels),
    approvedTier: tier3Approved ? 3 : tier2Approved ? 2 : tier1Approved ? 1 : 0,
    // Tier 3's decision comes from the partner asynchronously, same as 1 and
    // 2 — it needs the same poll to catch it.
    awaitingReview: tier1Pending || tier2Pending || tier3Pending,
    canSubmitTier1: !tier1Approved && !tier1Pending,
    canSubmitTier2: tier1Approved && !tier2Approved && !tier2Pending,
    canSubmitTier3: tier2Approved && !tier3Approved && !tier3Pending,
    tier3Pending,
    rejectionReason: rejected?.rejectionReason ?? null,
    tier3RejectionReason: tier3Rejected
      ? (tier3?.rejectionReason ?? null)
      : null,
    pendingTier,
    rejectedTier,
  };
};
