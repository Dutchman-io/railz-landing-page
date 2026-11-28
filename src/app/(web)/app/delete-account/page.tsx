"use client";

import { useState } from "react";
import { useAuth } from "@/state/auth";
import { deleteAccount } from "@/lib/account";
import { apiErrorStatus, friendlyErrorMessage } from "@/lib/api";
import { isTwoFactorRequired, stepUpPrompt } from "@/lib/twoFactor";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CodeInput, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

// Typed exactly, in capitals, before the button will act. A destructive,
// irreversible action should cost more than one click next to "Sign out".
const CONFIRM_WORD = "DELETE";

// How long the records we are required to keep are kept for after closure.
// Must match the public /delete-account page.
const RETENTION = "five years";

const REMOVED = [
  "Your name, email address, phone number and home address",
  "Your password and your two-factor authenticator secret",
  "Your saved payout bank accounts",
  "Any API keys issued to you",
];

const KEPT = [
  "Verification records — your BVN and NIN, and any ID document you uploaded",
  "Your transaction, payout and ledger history, including the bank account recorded on each payout",
];

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-muted" aria-hidden="true">
            •
          </span>
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DeleteAccountPage() {
  const { signOut } = useAuth();
  const toast = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  // Set by a TWO_FACTOR_REQUIRED refusal: the code field shows, with what
  // to do above it.
  const [codePrompt, setCodePrompt] = useState<{ title: string; message: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const armed = confirmation.trim().toUpperCase() === CONFIRM_WORD && password.length > 0;

  const onDelete = async () => {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    const sentCode = codePrompt ? twoFactorCode.trim() : "";
    try {
      await deleteAccount({ password, twoFactorCode: sentCode || undefined });
      toast(
        `Your account is closed. The records we are required to keep are listed on this screen and are held for ${RETENTION}.`,
      );
      // Sign out before anything else: the token is still valid until it
      // expires, and there is no account left for it to act on.
      await signOut();
    } catch (err) {
      if (isTwoFactorRequired(err)) {
        // Codes are single-use: a refused one is cleared, not resubmitted.
        setTwoFactorCode("");
        setCodePrompt(await stepUpPrompt(err, !!sentCode));
        setBusy(false);
        return;
      }
      if (apiErrorStatus(err) === 400 && /incorrect password/i.test(friendlyErrorMessage(err, ""))) {
        setPassword("");
        setError("Incorrect password. Check it and try again.");
        setBusy(false);
        return;
      }
      // The server refuses while a balance is held or a transfer is in flight
      // and names which. Its message is the useful one: don't replace it.
      setError(friendlyErrorMessage(err, "Try again."));
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest text-primary">ACCOUNT</p>
      <PageHeader
        title="Delete account"
        subtitle="This closes your account and cannot be undone. You will not be able to sign in again."
        back={{ href: "/app/settings", label: "Settings" }}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <p className="text-sm text-muted">Before you can delete</p>
            <p>
              Withdraw any balance you are still holding, including liquidity you have committed to the pool, and wait
              for transfers in progress to finish. We will tell you which is outstanding if anything is.
            </p>
          </Card>

          <Card className="flex flex-col gap-4">
            <p className="text-sm text-muted">What we delete</p>
            <Bullets items={REMOVED} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <p className="text-sm text-muted">What we keep, and why</p>
            <p>
              Anti-money-laundering rules require us to keep records of who we verified and what we moved for them
              after an account closes. These are held for {RETENTION} from the day your account is closed, and are then
              deleted:
            </p>
            <Bullets items={KEPT} />
            <p>They are not used for anything else once your account is closed.</p>
          </Card>

          <Card>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void onDelete();
              }}
            >
              <p className="text-sm text-muted">Confirm</p>
              <Input
                label={`Type ${CONFIRM_WORD} to confirm`}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                placeholder={CONFIRM_WORD}
              />
              <Input
                label="Your password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              {codePrompt && (
                <>
                  <Alert tone="info">
                    <strong className="font-semibold">{codePrompt.title}.</strong> {codePrompt.message}
                  </Alert>
                  <CodeInput
                    label="Security code"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                  />
                </>
              )}
              {error && (
                <Alert>
                  <strong className="font-semibold">Account not deleted.</strong> {error}
                </Alert>
              )}
              <Button type="submit" variant={armed ? "danger" : "primary"} disabled={!armed} loading={busy}>
                Delete my account
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
