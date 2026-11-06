"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Loading } from "@/components/ui/Spinner";
import { CountryPicker, type CountryOption } from "@/components/common/CountryPicker";
import { Choice } from "@/components/kyc/Choice";
import { useGoBack } from "@/components/kyc/useGoBack";
import { apiErrorCode, friendlyErrorMessage } from "@/lib/api";
import {
  INTERNATIONAL_STATUS_KEY,
  QUESTIONNAIRE_INVALID,
  QUESTIONNAIRE_NOT_REQUIRED,
  QUESTIONNAIRE_UNAVAILABLE,
  internationalQuestionnaireKey,
  refreshInternationalStatus,
  sameGroup,
  submitInternationalQuestionnaire,
  useInternationalQuestionnaire,
  type InternationalGroupKey,
  type InternationalQuestionnaire,
  type InternationalStatusView,
  type QuestionnaireAnswers,
  type QuestionnaireChoice,
} from "@/lib/international";

const HELPER_TEXT = "Our partner asks every customer this before enabling international transfers.";

const VERIFICATION_REQUIRED = "INTERNATIONAL_VERIFICATION_REQUIRED";

/** The pickers take {code, name}; a question's options are {key, label}. */
const toOptions = (choice: QuestionnaireChoice): CountryOption[] => choice.options.map((o) => ({ code: o.key, name: o.label }));

/** A stored answer, only if it is still one of the options offered. */
const prefill = (value: string | boolean | undefined, choice: QuestionnaireChoice): string | null =>
  typeof value === "string" && choice.options.some((o) => o.key === value) ? value : null;

interface Draft {
  sourceOfFunds: string | null;
  accountPurpose: string | null;
  accountPurposeOther: string;
  employmentStatus: string | null;
  occupation: string | null;
  expectedMonthlyPayments: string | null;
  actingAsIntermediary: boolean | null;
}

const EMPTY: Draft = {
  sourceOfFunds: null,
  accountPurpose: null,
  accountPurposeOther: "",
  employmentStatus: null,
  occupation: null,
  expectedMonthlyPayments: null,
  actingAsIntermediary: null,
};

const draftFrom = (q: InternationalQuestionnaire): Draft => {
  const a = q.answers ?? {};
  return {
    sourceOfFunds: prefill(a.sourceOfFunds, q.sourceOfFunds),
    accountPurpose: prefill(a.accountPurpose, q.accountPurpose),
    accountPurposeOther: typeof a.accountPurposeOther === "string" ? a.accountPurposeOther : "",
    employmentStatus: prefill(a.employmentStatus, q.employmentStatus),
    occupation: prefill(a.occupation, q.occupation),
    expectedMonthlyPayments: prefill(a.expectedMonthlyPayments, q.expectedMonthlyPayments),
    actingAsIntermediary: typeof a.actingAsIntermediary === "boolean" ? a.actingAsIntermediary : null,
  };
};

/** The answers to send, or null while any question is unanswered. */
const answersOf = (draft: Draft, q: InternationalQuestionnaire): QuestionnaireAnswers | null => {
  const other = draft.accountPurposeOther.trim();
  const needsOther = draft.accountPurpose === q.accountPurpose.otherKey;
  if (
    !draft.sourceOfFunds ||
    !draft.accountPurpose ||
    !draft.employmentStatus ||
    !draft.occupation ||
    !draft.expectedMonthlyPayments ||
    draft.actingAsIntermediary === null ||
    (needsOther && (other.length === 0 || other.length > q.accountPurpose.otherMaxLength))
  ) {
    return null;
  }
  return {
    sourceOfFunds: draft.sourceOfFunds,
    accountPurpose: draft.accountPurpose,
    ...(needsOther ? { accountPurposeOther: other } : {}),
    employmentStatus: draft.employmentStatus,
    occupation: draft.occupation,
    expectedMonthlyPayments: draft.expectedMonthlyPayments,
    actingAsIntermediary: draft.actingAsIntermediary,
  };
};

const isGroupKey = (value: unknown): value is InternationalGroupKey =>
  value === "americas_europe" || value === "africa_asia" || value === "china";

/** What came of the answers, shown in a dialog that leads back. */
interface Done {
  title: string;
  body: string;
  button: string;
}

/**
 * Our partner's questions about where the customer's money comes from and
 * what they will use international transfers for. The questions and every
 * label come from the server; this page only lays them out.
 */
function Questions() {
  const goBack = useGoBack();
  const queryClient = useQueryClient();
  const groupParam = useSearchParams().get("group");
  const group: InternationalGroupKey = isGroupKey(groupParam) ? groupParam : "americas_europe";
  const questionnaire = useInternationalQuestionnaire(group);
  const q = questionnaire.data;

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  // Prefill from the last submission whenever a new questionnaire arrives,
  // during render rather than in an effect, so the empty form never flashes.
  const [prefilledFrom, setPrefilledFrom] = useState<InternationalQuestionnaire | undefined>(undefined);
  if (q && q !== prefilledFrom) {
    setPrefilledFrom(q);
    setDraft(draftFrom(q));
  }

  const answers = useMemo(() => (q ? answersOf(draft, q) : null), [draft, q]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const finish = (view: InternationalStatusView) => {
    queryClient.setQueryData(INTERNATIONAL_STATUS_KEY, view);
    void queryClient.invalidateQueries({ queryKey: internationalQuestionnaireKey(group) });
    const after = view.groups.find((g) => sameGroup(g.key, group));
    if (after?.status === "APPROVED") {
      setDone({ title: "You're all set", body: "International transfers are now enabled for these countries.", button: "Done" });
    } else if (after?.status === "NEEDS_ATTENTION") {
      setDone({
        title: "Thanks, one more step",
        body: after.reason ?? "Our partner needs something else before it can finish. We will show you what next.",
        button: "Continue",
      });
    } else {
      setDone({
        title: "Thanks",
        body: "Our partner is now reviewing your details. We will let you know as soon as there is a decision.",
        button: "Done",
      });
    }
  };

  const submit = async () => {
    if (!answers || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      finish(await submitInternationalQuestionnaire(group, answers));
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === QUESTIONNAIRE_NOT_REQUIRED) {
        // Already approved: nothing to answer. Show where they stand.
        try {
          finish(await refreshInternationalStatus());
        } catch {
          goBack();
        }
        return;
      }
      setError(
        code === QUESTIONNAIRE_INVALID
          ? "Some answers were not accepted. Please check them and try again."
          : code === QUESTIONNAIRE_UNAVAILABLE
            ? "We could not send your answers just now. Please try again in a moment."
            : code === VERIFICATION_REQUIRED
              ? "Start international verification first, then come back to these questions."
              : friendlyErrorMessage(err, "We could not send your answers. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!q) {
    return (
      <Card className="flex flex-col gap-4">
        {questionnaire.isError ? (
          <>
            <Alert>{friendlyErrorMessage(questionnaire.error, "We could not load the questions right now.")}</Alert>
            <Button variant="secondary" onClick={() => void questionnaire.refetch()}>
              Try again
            </Button>
          </>
        ) : (
          <Loading label="Loading the questions" />
        )}
      </Card>
    );
  }

  const needsOther = draft.accountPurpose === q.accountPurpose.otherKey;

  return (
    <>
      <Card className="flex flex-col gap-5">
        <CountryPicker
          label={q.sourceOfFunds.label}
          options={toOptions(q.sourceOfFunds)}
          value={draft.sourceOfFunds}
          onChange={(v) => set("sourceOfFunds", v)}
          placeholder="Choose one"
        />
        <CountryPicker
          label={q.accountPurpose.label}
          options={toOptions(q.accountPurpose)}
          value={draft.accountPurpose}
          onChange={(v) => set("accountPurpose", v)}
          placeholder="Choose one"
        />
        {needsOther && (
          <Input
            label={q.accountPurpose.otherLabel}
            value={draft.accountPurposeOther}
            onChange={(e) => set("accountPurposeOther", e.target.value)}
            maxLength={q.accountPurpose.otherMaxLength}
            placeholder="For example, paying school fees"
          />
        )}
        <CountryPicker
          label={q.employmentStatus.label}
          options={toOptions(q.employmentStatus)}
          value={draft.employmentStatus}
          onChange={(v) => set("employmentStatus", v)}
          placeholder="Choose one"
        />
        <CountryPicker
          label={q.occupation.label}
          options={toOptions(q.occupation)}
          value={draft.occupation}
          onChange={(v) => set("occupation", v)}
          placeholder="Search for your occupation"
        />
        <CountryPicker
          label={q.expectedMonthlyPayments.label}
          options={toOptions(q.expectedMonthlyPayments)}
          value={draft.expectedMonthlyPayments}
          onChange={(v) => set("expectedMonthlyPayments", v)}
          placeholder="Choose one"
        />

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{q.actingAsIntermediary.label}</p>
          <Choice
            label={q.actingAsIntermediary.label}
            options={[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ]}
            value={draft.actingAsIntermediary}
            onChange={(v) => set("actingAsIntermediary", v)}
          />
        </div>

        <Alert>{error}</Alert>
        {!answers && <p className="text-sm text-muted">Answer every question to continue.</p>}
        <Button loading={submitting} disabled={!answers} onClick={() => void submit()} block>
          Submit answers
        </Button>
      </Card>

      <Modal
        open={!!done}
        onClose={goBack}
        title={done?.title}
        footer={
          <Button onClick={goBack} block>
            {done?.button}
          </Button>
        }
      >
        <p>{done?.body}</p>
      </Modal>
    </>
  );
}

export default function InternationalQuestionsPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: "/app/settings", label: "Settings" }} title="Tell us about your money" subtitle={HELPER_TEXT} />
      <Suspense fallback={<Loading />}>
        <Questions />
      </Suspense>
    </div>
  );
}
