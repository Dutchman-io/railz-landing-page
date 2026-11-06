"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiErrorCode, friendlyErrorMessage } from "@/lib/api";
import {
  INTERNATIONAL_STATUS_KEY,
  detailsText,
  getInternationalTermsLink,
  internationalQuestionsHref,
  refreshInternationalStatus,
  type InternationalGroup,
  type InternationalGroupKey,
} from "@/lib/international";

/** Accepted already: nothing to open, only a status to re-read. */
const TERMS_ALREADY_ACCEPTED = "INTERNATIONAL_TERMS_ALREADY_ACCEPTED";

/** Support until the web app has a support inbox of its own. */
export const SUPPORT_MAILTO =
  "mailto:support@zemfi.ng?subject=" + encodeURIComponent("International transfers verification");

/**
 * Opens our partner's terms page in a new tab and, once the customer comes
 * back to this tab, asks the partner for its decision straight away and says
 * what came of it. (Ported from zemfi-mobile, where "back" is AppState.)
 */
export function useAcceptPartnerTerms(group: InternationalGroupKey) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const awaitingReturn = useRef(false);

  const finish = useCallback(async () => {
    try {
      const view = await refreshInternationalStatus();
      queryClient.setQueryData(INTERNATIONAL_STATUS_KEY, view);
      const after = view.groups.find((g) => g.key === group);
      if (!after) return;
      if (after.status === "APPROVED") {
        toast("You're all set. International transfers are now enabled for these countries.");
      } else if (after.status === "IN_REVIEW") {
        toast("Thanks. Our partner is now reviewing your details. We will let you know as soon as there is a decision.", "info");
      } else if (after.action?.type === "ACCEPT_TERMS") {
        toast("It looks like the terms were not accepted. Choose Review and accept to try again.", "info");
      } else if (after.reason) {
        toast(after.reason, "info");
      }
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: INTERNATIONAL_STATUS_KEY });
      toast(
        friendlyErrorMessage(error, "We couldn't check just now. Please check back in a few minutes."),
        "danger",
      );
    } finally {
      setBusy(false);
    }
  }, [group, queryClient, toast]);

  useEffect(() => {
    const onFocus = () => {
      if (awaitingReturn.current && document.visibilityState === "visible") {
        awaitingReturn.current = false;
        void finish();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [finish]);

  const start = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    // Open the tab inside the click, before the await, or popup blockers stop it.
    const tab = window.open("", "_blank");
    try {
      const url = await getInternationalTermsLink(group);
      awaitingReturn.current = true;
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (error) {
      tab?.close();
      awaitingReturn.current = false;
      if (apiErrorCode(error) === TERMS_ALREADY_ACCEPTED) {
        await finish();
        return;
      }
      setBusy(false);
      toast(friendlyErrorMessage(error, "Couldn't open the terms. Check your connection and try again."), "danger");
    }
  }, [busy, finish, group, toast]);

  return { start, busy };
}

/**
 * What a NEEDS_ATTENTION group asks of the customer, and the button for it:
 * accept our partner's terms, answer its questions, supply details (through
 * support, for now), or talk to support. A refusal offers `onTryAgain`.
 */
export function InternationalAttention({ group, onTryAgain }: { group: InternationalGroup; onTryAgain: () => void }) {
  const router = useRouter();
  const terms = useAcceptPartnerTerms(group.key);
  if (group.status !== "NEEDS_ATTENTION") return null;
  const action = group.action;

  const block = (children: React.ReactNode) => <div className="flex flex-col gap-3">{children}</div>;
  const support = (
    <ButtonLink href={SUPPORT_MAILTO} variant="secondary">
      Contact support
    </ButtonLink>
  );

  if (action?.type === "ACCEPT_TERMS") {
    return block(
      <>
        <p className="text-sm">Accept our partner&apos;s terms to finish.</p>
        <Button loading={terms.busy} onClick={() => void terms.start()}>
          Review and accept
        </Button>
      </>,
    );
  }
  if (action?.type === "ANSWER_QUESTIONNAIRE") {
    return block(
      <>
        <p className="text-sm font-semibold">Tell us about your money</p>
        <p className="text-sm text-muted">Our partner asks every customer this before enabling international transfers.</p>
        <Button onClick={() => router.push(internationalQuestionsHref(group.key))}>Answer a few questions</Button>
      </>,
    );
  }
  if (action?.type === "PROVIDE_DETAILS") {
    return block(
      <>
        <p className="text-sm text-warning">
          Our partner needs: {detailsText(action.fields)}. Contact support and we will help you send them.
        </p>
        {support}
      </>,
    );
  }
  if (action?.type === "CONTACT_SUPPORT") {
    return block(
      <>
        {group.reason && <p className="text-sm text-warning">{group.reason}</p>}
        {support}
      </>,
    );
  }
  return block(
    <>
      {group.reason && <p className="text-sm text-warning">{group.reason}</p>}
      <Button variant="secondary" onClick={onTryAgain}>
        Try again
      </Button>
    </>,
  );
}
