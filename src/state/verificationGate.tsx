"use client";

/**
 * Ported from zemfi-mobile's state/verificationGate.tsx: one modal for every
 * VERIFICATION_REQUIRED (409) or KYC_REQUIRED (403) the API answers, instead
 * of a bare server sentence. The request still rejects; pages keep their own
 * error handling.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setVerificationRequiredHandler } from "@/lib/api";
import { useKycSummary } from "@/lib/kyc";
import { useAuth } from "@/state/auth";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface VerificationGateValue {
  /** Show the "verify to continue" modal; for pages that pre-empt the API. */
  show: () => void;
}

const Ctx = createContext<VerificationGateValue | null>(null);

const REOPEN_COOLDOWN_MS = 5 * 60_000;

export function VerificationGateProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const dismissedAt = useRef(0);

  const show = useCallback(() => {
    if (Date.now() - dismissedAt.current < REOPEN_COOLDOWN_MS) return;
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    dismissedAt.current = Date.now();
    setVisible(false);
  }, []);

  useEffect(() => {
    setVerificationRequiredHandler(show);
    return () => setVerificationRequiredHandler(null);
  }, [show]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {visible && <VerificationRequiredModal onClose={close} />}
    </Ctx.Provider>
  );
}

function VerificationRequiredModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { status } = useAuth();
  const { summary } = useKycSummary();
  if (status !== "authenticated") return null;
  const inReview = summary.awaitingReview;

  return (
    <Modal
      open
      onClose={onClose}
      title={inReview ? "Your verification is being reviewed" : "Verify your identity to continue"}
      footer={
        <>
          {inReview ? (
            <Button onClick={onClose}>Okay</Button>
          ) : (
            <Button
              onClick={() => {
                onClose();
                router.push(summary.canSubmitTier2 ? "/app/kyc-tier2" : "/app/kyc-tier1");
              }}
            >
              Verify now
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
        </>
      }
    >
      <p className="text-muted">
        {inReview
          ? "This action unlocks as soon as your details are approved. We will let you know the moment that happens."
          : "Funding, converting and sending need a verified identity. It takes a few minutes: your BVN and a selfie first, then your NIN and an ID document for higher limits."}
      </p>
    </Modal>
  );
}

export const useVerificationGate = (): VerificationGateValue => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVerificationGate must be used inside <VerificationGateProvider>");
  return ctx;
};
