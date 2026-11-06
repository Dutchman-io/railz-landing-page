"use client";

import { useState } from "react";
import { useAuth } from "@/state/auth";
import { deleteAccount } from "@/lib/account";
import { friendlyErrorMessage } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const armed = confirmation.trim().toUpperCase() === CONFIRM_WORD;

  const onDelete = async () => {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      toast(
        `Your account is closed. The records we are required to keep are listed on this screen and are held for ${RETENTION}.`,
      );
      // Sign out before anything else: the token is still valid until it
      // expires, and there is no account left for it to act on.
      await signOut();
    } catch (err) {
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
