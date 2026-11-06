"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { CountryPicker } from "@/components/common/CountryPicker";
import { PhoneInput } from "@/components/common/PhoneInput";
import { Choice } from "@/components/kyc/Choice";
import { api, apiErrorCode, friendlyErrorMessage } from "@/lib/api";
import { normalizeReferralCode, REFERRAL_CODE_INVALID } from "@/lib/referral";
import { useCountries } from "@/lib/countries";
import { PRIVACY_POLICY_URL, TERMS_URL } from "@/lib/legal";
import { nationalNumber, toE164 } from "@/lib/phone";
import { useAuth } from "@/state/auth";
import type { CreateUserResponse } from "@/types/api";

/**
 * A business is a different kind of account, not a switch on a personal one:
 * it verifies against a company register rather than a person, and it is the
 * kind of account allowed to pay third parties. Chosen here and fixed after.
 */
type AccountType = "personal" | "business";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  // The NATIONAL number only, digits, no trunk zero. The dial code comes from
  // `country` and the two are combined into E.164 on submit.
  phoneNumber: string;
  country: string;
  password: string;
  // Business only. The registered name and number are what the register is
  // checked against, so they have to be what it says -- not the name over the
  // door, which is what `tradingName` is for.
  legalName: string;
  registrationNumber: string;
  // Country of incorporation, which decides the register.
  businessCountry: string;
  tradingName: string;
  // Optional. Prefilled from an invite link (?ref=CODE).
  referralCode: string;
}

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  country: "",
  password: "",
  legalName: "",
  registrationNumber: "",
  businessCountry: "",
  tradingName: "",
  referralCode: "",
};

function RegisterForm({ isBusiness }: { isBusiness: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();
  const { data: countries = [] } = useCountries();
  const [form, setForm] = useState<FormState>(() => {
    const ref = params.get("ref");
    return { ...emptyForm, referralCode: ref ? normalizeReferralCode(ref) : "" };
  });
  const [referralError, setReferralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const validate = (): string | null => {
    if (!form.firstName.trim()) return "First name is required";
    if (!form.lastName.trim()) return "Last name is required";
    if (!form.email.trim()) return "Email is required";
    if (!form.country) return "Country is required";
    if (!form.phoneNumber.trim()) return "Phone number is required";
    // Null here means the country carries no dial code we know, so there is no
    // international number to send.
    if (!toE164(form.phoneNumber, form.country)) return "Enter a valid phone number for the country you selected";
    if (form.password.length < 8) return "Password must be at least 8 characters";
    if (isBusiness) {
      // Both are what the company register is checked against.
      if (!form.legalName.trim()) return "Registered company name is required";
      if (!form.registrationNumber.trim()) return "Company registration number is required";
      if (!form.businessCountry) return "Country of incorporation is required";
    }
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setReferralError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setLoading(true);
    const email = form.email.trim().toLowerCase();
    try {
      await api.post<CreateUserResponse>("/user/create", {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email,
        phoneNumber: toE164(form.phoneNumber, form.country),
        country: form.country,
        password: form.password,
        ...(form.referralCode.trim() ? { referralCode: normalizeReferralCode(form.referralCode) } : {}),
        // Sent only for a business. A personal signup posts exactly what it
        // always did.
        ...(isBusiness
          ? {
              business: {
                legalName: form.legalName.trim(),
                registrationNumber: form.registrationNumber.trim(),
                country: form.businessCountry,
                ...(form.tradingName.trim() ? { tradingName: form.tradingName.trim() } : {}),
              },
            }
          : {}),
      });
      // As on mobile: sign in with the same credentials, whatever create returned.
      await signIn(email, form.password);
      router.replace("/app");
    } catch (err) {
      const message = friendlyErrorMessage(err, "Could not create account. Try again.");
      // A mistyped code is the field's to say: the rest of the form is fine.
      if (apiErrorCode(err) === REFERRAL_CODE_INVALID) {
        setReferralError(message);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {isBusiness && <p className="text-sm text-muted">Your own details first — you are the person opening the account.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First name" placeholder="Ada" autoComplete="given-name" autoCapitalize="words" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
        <Input label="Last name" placeholder="Lovelace" autoComplete="family-name" autoCapitalize="words" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
      </div>
      <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => update("email", e.target.value)} />
      <CountryPicker
        label="Country"
        options={countries}
        value={form.country || null}
        onChange={(code) => {
          update("country", code);
          // Re-normalise against the new country: a trunk zero or dial code
          // that was right for the old one may not be for this one.
          update("phoneNumber", nationalNumber(form.phoneNumber, code));
        }}
      />
      <PhoneInput country={form.country || null} value={form.phoneNumber} onChangeText={(v) => update("phoneNumber", nationalNumber(v, form.country))} />
      <PasswordInput label="Password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(e) => update("password", e.target.value)} />
      <Input
        label="Referral code (optional)"
        placeholder="e.g. K7M2QX9P"
        autoCapitalize="characters"
        autoCorrect="off"
        value={form.referralCode}
        onChange={(e) => {
          update("referralCode", e.target.value);
          if (referralError) setReferralError(null);
        }}
        error={referralError}
      />
      {isBusiness && (
        <>
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">The company</p>
            <p className="mt-1 text-sm text-muted">
              As the register has it. We check the name and number against the company register, so they need to match exactly.
            </p>
          </div>
          <Input label="Registered company name" placeholder="ACME TRADING LIMITED" autoCapitalize="characters" value={form.legalName} onChange={(e) => update("legalName", e.target.value)} />
          <Input label="Registration number" placeholder="RC1234567" autoCapitalize="characters" value={form.registrationNumber} onChange={(e) => update("registrationNumber", e.target.value)} />
          <CountryPicker label="Country of incorporation" options={countries} value={form.businessCountry || null} onChange={(code) => update("businessCountry", code)} />
          <Input label="Trading name (optional)" placeholder="Acme" value={form.tradingName} onChange={(e) => update("tradingName", e.target.value)} />
        </>
      )}
      <Alert>{error}</Alert>
      <Button type="submit" loading={loading} block>
        {isBusiness ? "Create business account" : "Create account"}
      </Button>
      <p className="text-center text-xs text-muted">
        By creating an account you agree to our{" "}
        <a href={TERMS_URL} target="_blank" rel="noopener" className="text-primary underline">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener" className="text-primary underline">
          Privacy Policy
        </a>
        .
      </p>
      <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
        I already have an account
      </Link>
    </form>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const isBusiness = accountType === "business";

  // Signed in already (or just now): the app, not a second account.
  useEffect(() => {
    if (status === "authenticated") router.replace("/app");
  }, [status, router]);

  return (
    <AuthCard
      wide
      title="Create your account."
      subtitle={isBusiness ? "Less than a minute. Verify the company after." : "Less than a minute. Verify identity after."}
    >
      <div className="flex flex-col gap-4">
        {/* Chosen before anything is typed, because it changes what is asked
            and cannot be changed later. */}
        <Choice
          label="Account type"
          options={[
            { label: "Personal", value: "personal" },
            { label: "Business", value: "business" },
          ]}
          value={accountType}
          onChange={setAccountType}
        />
        <Suspense>
          <RegisterForm isBusiness={isBusiness} />
        </Suspense>
      </div>
    </AuthCard>
  );
}
