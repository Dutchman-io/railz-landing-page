"use client";

import { useState } from "react";
import {
  deviceName,
  revokeOtherSessions,
  revokeSession,
  type Session,
  useInvalidateSessions,
  useSessions,
} from "@/lib/sessions";
import { formatWhen } from "@/lib/activity";
import { friendlyErrorMessage } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { Loading } from "@/components/ui/Spinner";

type Confirm = { kind: "one"; session: Session } | { kind: "others" } | null;

/**
 * Every device signed in to this account, newest activity first, with the one
 * in use marked. Signing a device out ends its session on its next request;
 * "everywhere else" does that for all but this one. (Ported from zemfi-mobile.)
 */
export default function SessionsPage() {
  const { data: sessions = [], isLoading } = useSessions();
  const invalidate = useInvalidateSessions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.current);

  const run = (id: string, action: () => Promise<unknown>) => {
    setConfirm(null);
    setError(null);
    setBusyId(id);
    void action()
      .then(invalidate)
      .catch((err: unknown) => setError(friendlyErrorMessage(err, "Please try again.")))
      .finally(() => setBusyId(null));
  };

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest text-primary">SECURITY</p>
      <PageHeader
        title="Devices"
        subtitle="Devices signed in to your account. If you see one you do not recognise, sign it out and change your password."
        back={{ href: "/app/settings", label: "Settings" }}
        action={
          others.length > 0 ? (
            <Button variant="ghost" loading={busyId === "others"} onClick={() => setConfirm({ kind: "others" })}>
              Sign out everywhere else
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>
            <strong className="font-semibold">Could not sign out.</strong> {error}
          </Alert>
        </div>
      )}

      {isLoading ? (
        <Loading />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex flex-col gap-2 rounded-2xl border bg-surface p-5 ${session.current ? "border-primary" : "border-border"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-semibold">{deviceName(session.device)}</p>
                {session.current && (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-bold tracking-wider text-on-primary">
                    THIS DEVICE
                  </span>
                )}
              </div>
              <p className="text-sm text-muted">
                Last active {formatWhen(session.lastUsedAt)}
                {session.ip ? ` · ${session.ip}` : ""}
              </p>
              <p className="text-sm text-muted">Signed in {formatWhen(session.createdAt)}</p>
              {!session.current && (
                <div className="mt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyId === session.id}
                    onClick={() => setConfirm({ kind: "one", session })}
                  >
                    Sign out this device
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === "one"
            ? `Sign out ${deviceName(confirm.session.device)}?`
            : "Sign out everywhere else?"
        }
        footer={
          <>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm?.kind === "one") {
                  const id = confirm.session.id;
                  run(id, () => revokeSession(id));
                } else run("others", revokeOtherSessions);
              }}
            >
              {confirm?.kind === "one" ? "Sign out" : "Sign out others"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep
            </Button>
          </>
        }
      >
        <p className="text-muted">
          {confirm?.kind === "one"
            ? "It will need the password (and code, if you use one) to sign in again."
            : `${others.length} other device${others.length === 1 ? "" : "s"} will be signed out. This device stays signed in.`}
        </p>
      </Modal>
    </div>
  );
}
