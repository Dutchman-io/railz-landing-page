"use client";

import Link from "next/link";
import { useState } from "react";
import { api, friendlyErrorMessage } from "@/lib/api";
import { AuthCard } from "@/components/AuthCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CodeInput, Input, PasswordInput } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

type Step = "email" | "reset" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // The backend answers the same whether or not the email has an account.
      await api.post("/authentication/forgot-password", { email: email.trim() });
      setStep("reset");
    } catch (err) {
      setError(friendlyErrorMessage(err, "Something went wrong. Check your network and try again."));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/authentication/reset-password", { email: email.trim(), otp: otp.trim(), newPassword });
      setStep("done");
    } catch (err) {
      setError(friendlyErrorMessage(err, "Something went wrong. Check your network and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Forgot password?"
      subtitle={
        step === "email"
          ? "Enter your email and we’ll send you a 6-digit code."
          : step === "reset"
            ? `Enter the code we sent to ${email.trim()}.`
            : undefined
      }
    >
      {step === "done" ? (
        <div className="flex flex-col gap-4">
          <p>Your password has been reset. Sign in with your new password.</p>
          <ButtonLink href="/login">Back to sign in</ButtonLink>
        </div>
      ) : step === "email" ? (
        <form onSubmit={requestCode} className="flex flex-col gap-4">
          <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Alert>{error}</Alert>
          <Button type="submit" loading={loading} disabled={!email.trim()} block>
            Send code
          </Button>
          <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </form>
      ) : (
        <form onSubmit={submitReset} className="flex flex-col gap-4">
          <CodeInput label="Code from your email" value={otp} onChange={(e) => setOtp(e.target.value)} />
          <PasswordInput label="New password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <PasswordInput label="Confirm new password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <Alert>{error}</Alert>
          <Button type="submit" loading={loading} disabled={!otp || !newPassword} block>
            Reset password
          </Button>
          <Button variant="ghost" onClick={() => setStep("email")}>
            Use a different email
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
