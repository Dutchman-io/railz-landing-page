"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useQueryClient } from "@tanstack/react-query";
import {
  TWO_FACTOR_KEY,
  type TwoFactorSetup,
  disableTwoFactor,
  enableTwoFactor,
  setupTwoFactor,
  useTwoFactorStatus,
} from "@/lib/twoFactor";
import { friendlyErrorMessage } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Loading } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";

/** The otpauth URL drawn as a QR image, black on white so every scanner reads it. */
function OtpQr({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: 360, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);
  return (
    <div className="flex justify-center py-2">
      <div className="rounded-2xl bg-white p-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="QR code for your authenticator app" width={180} height={180} className="size-45" />
        ) : (
          <div className="size-45" />
        )}
      </div>
    </div>
  );
}

export default function TwoFactorPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: enabled, isLoading } = useTwoFactorStatus();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: TWO_FACTOR_KEY });

  const startSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      setSetup(await setupTwoFactor());
    } catch (err) {
      setError({ title: "Error", body: friendlyErrorMessage(err, "Try again.") });
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      await enableTwoFactor(code.trim());
      setSetup(null);
      setCode("");
      await refreshStatus();
      toast("Two-factor enabled. Your account is now protected.");
    } catch (err) {
      setError({ title: "Invalid code", body: friendlyErrorMessage(err, "Try again.") });
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    setBusy(true);
    setError(null);
    try {
      await disableTwoFactor(code.trim());
      setCode("");
      await refreshStatus();
      toast("Two-factor disabled");
    } catch (err) {
      setError({ title: "Invalid code", body: friendlyErrorMessage(err, "Try again.") });
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      toast("Copied");
    } catch {
      toast("Could not copy. Select the key and copy it instead.", "danger");
    }
  };

  const errorAlert = error && (
    <Alert>
      <strong className="font-semibold">{error.title}.</strong> {error.body}
    </Alert>
  );

  const submitOn = (action: () => Promise<void>) => (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length >= 6 && !busy) void action();
  };

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Two-factor authentication"
        subtitle="Protect sign-in and withdrawals with an authenticator app (Google Authenticator, Authy, 1Password…)."
        back={{ href: "/app/settings", label: "Settings" }}
      />

      {isLoading ? (
        <Loading />
      ) : enabled ? (
        <Card>
          <form className="flex flex-col gap-4" onSubmit={submitOn(confirmDisable)}>
            <p className="font-display text-lg font-semibold text-success">● Enabled</p>
            <p className="text-sm text-muted">Enter a current code to turn two-factor off.</p>
            <CodeInput label="Authenticator code" value={code} onChange={(e) => setCode(e.target.value)} />
            {errorAlert}
            <Button type="submit" variant="secondary" loading={busy} disabled={code.trim().length < 6}>
              Disable two-factor
            </Button>
          </form>
        </Card>
      ) : setup ? (
        <Card>
          <form className="flex flex-col gap-4" onSubmit={submitOn(confirmEnable)}>
            <p className="font-semibold">1. Scan this in your authenticator app</p>
            <OtpQr value={setup.otpauthUrl} />
            <p className="font-semibold">Or enter this key manually</p>
            <button
              type="button"
              onClick={() => void copySecret(setup.secret)}
              title="Copy"
              className="rounded-xl border border-border bg-background px-4 py-3 text-center font-mono text-sm break-all select-all hover:border-primary"
            >
              {setup.secret}
            </button>
            <p className="font-semibold">2. Enter the 6-digit code it shows</p>
            <CodeInput label="Authenticator code" value={code} onChange={(e) => setCode(e.target.value)} />
            {errorAlert}
            <Button type="submit" loading={busy} disabled={code.trim().length < 6}>
              Enable two-factor
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <p className="font-display text-lg font-semibold text-muted">Not enabled</p>
          {errorAlert}
          <Button onClick={() => void startSetup()} loading={busy}>
            Set up two-factor
          </Button>
        </Card>
      )}
    </div>
  );
}
