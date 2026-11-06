"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/state/auth";
import { friendlyErrorMessage } from "@/lib/api";
import { isTwoFactorRequired, twoFactorMessage } from "@/lib/twoFactor";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/Button";
import { CodeInput, Input, PasswordInput } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

/** Only same-site paths inside the app, so ?next= cannot send anyone elsewhere. */
const safeNext = (next: string | null): string =>
  next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = safeNext(params.get("next"));

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, router, next]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const sentCode = needs2fa ? code.trim() : "";
    try {
      await signIn(email.trim(), password, sentCode || undefined);
      router.replace(next);
    } catch (err) {
      if (isTwoFactorRequired(err)) {
        // A code works once, so a refused one is cleared, not resubmitted.
        setNeeds2fa(true);
        setCode("");
        setError(sentCode ? twoFactorMessage(true) : "Enter the 6-digit code from your authenticator app.");
      } else {
        setError(friendlyErrorMessage(err, "Sign-in failed. Check your network and try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <PasswordInput label="Password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {needs2fa && <CodeInput label="Authenticator code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />}
      <Alert>{error}</Alert>
      <Button type="submit" loading={loading} block>
        Sign in
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthCard title="Welcome back." subtitle="Sign in to pay, get paid and hold stablecoins.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
