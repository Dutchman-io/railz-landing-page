"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/state/auth";
import { REVERIFICATION_KEY, type ReverificationItem, useKycSummary, useReverification } from "@/lib/kyc";
import { useCountries } from "@/lib/countries";
import { nationalNumber, toE164 } from "@/lib/phone";
import { updateProfile, type ProfileUpdate } from "@/lib/profile";
import { friendlyErrorMessage } from "@/lib/api";
import { BALANCES_KEY } from "@/lib/wallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { CountryPicker } from "@/components/common/CountryPicker";
import { PhoneInput } from "@/components/common/PhoneInput";

const initials = (first?: string, last?: string) => `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "·";

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

const TIER_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "Not verified",
  1: "Tier 1 verified",
  // Tier 2 is no longer the ceiling: the cross-border corridors need tier 3.
  2: "Tier 2 verified",
  3: "Fully verified",
};

const isBlank = (v?: string | null) => v === null || v === undefined || v === "";

type Notice = { title: string; body: string } | null;

function NoticeAlert({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <Alert>
      <strong className="font-semibold">{notice.title}.</strong> {notice.body}
    </Alert>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { summary } = useKycSummary();
  const { data: countries } = useCountries();
  const { data: reverification } = useReverification();
  const queryClient = useQueryClient();

  // Profile can only be COMPLETED (empty fields filled) before verification;
  // once any tier is approved, identity is locked. Mirrors the backend rule.
  const locked = summary.approvedTier > 0;
  const emptyFields = useMemo(
    () => ({
      firstName: isBlank(user?.firstName),
      lastName: isBlank(user?.lastName),
      phoneNumber: isBlank(user?.phoneNumber),
      country: isBlank(user?.country),
    }),
    [user],
  );
  const canComplete = !locked && Object.values(emptyFields).some((empty) => empty);

  const countryName = countries?.find((c) => c.code === user?.country)?.name ?? user?.country ?? "—";

  const rows: [string, string][] = [
    ["Full name", `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "—"],
    ["Email", user?.email ?? "—"],
    ["Phone", user?.phoneNumber || "—"],
    ["Country", countryName],
    ["Account type", user?.userType === "BUSINESS" ? "Business" : "Personal"],
    ["Verification", TIER_LABEL[summary.approvedTier]],
    ["Member since", formatDate(user?.createdAt)],
  ];

  return (
    <div>
      <PageHeader title="Profile" back={{ href: "/app/settings", label: "Settings" }} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary font-display text-2xl font-bold text-on-primary">
              {initials(user?.firstName, user?.lastName)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-semibold">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-muted">{user?.email}</p>
            </div>
          </div>

          <Card className="py-1 sm:py-1">
            <dl className="divide-y divide-border">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="text-muted">{label}</dt>
                  <dd className="min-w-0 truncate text-right font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div>
          {reverification && reverification.items.length > 0 ? (
            <ReverificationCard
              items={reverification.items}
              message={reverification.message}
              onSaved={async () => {
                await refreshUser();
                await queryClient.invalidateQueries({ queryKey: REVERIFICATION_KEY });
                await queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
              }}
            />
          ) : canComplete ? (
            <CompleteProfileCard
              emptyFields={emptyFields}
              savedCountry={user?.country ?? null}
              onSaved={async () => {
                await refreshUser();
                await queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
              }}
            />
          ) : locked ? (
            <p className="text-center text-sm text-subtle lg:text-left">Your profile is locked after verification.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const ITEM_LABEL: Record<ReverificationItem, string> = {
  BVN: "BVN",
  NIN: "NIN",
  COUNTRY: "Country",
  ID_DOCUMENT: "ID document",
  ADDRESS_PROOF: "Proof of address",
};

// An admin has asked the user to re-verify specific items. Country is edited
// inline here; identity/documents route to the relevant KYC screen.
function ReverificationCard({
  items,
  message,
  onSaved,
}: {
  items: ReverificationItem[];
  message: string | null;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const { data: countryOptions } = useCountries();
  const [country, setCountry] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const needsCountry = items.includes("COUNTRY");
  const needsIdentity = items.includes("BVN") || items.includes("NIN");
  const needsDocument = items.includes("ID_DOCUMENT") || items.includes("ADDRESS_PROOF");

  const saveCountry = async () => {
    if (!country) return;
    setSaving(true);
    setNotice(null);
    try {
      await updateProfile({ country });
      await onSaved();
      toast("Your country was updated.");
    } catch (err) {
      setNotice({ title: "Could not update", body: friendlyErrorMessage(err, "Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">Action needed: re-verify your details</h2>
      <p className="text-sm whitespace-pre-line text-muted">
        We need you to re-verify: {items.map((i) => ITEM_LABEL[i]).join(", ")}.{message ? `\n\n${message}` : ""}
      </p>
      <NoticeAlert notice={notice} />

      {needsCountry && (
        <>
          <CountryPicker label="Country" options={countryOptions ?? []} value={country} onChange={setCountry} />
          <Button onClick={() => void saveCountry()} loading={saving} disabled={!country}>
            {saving ? "Saving…" : "Update country"}
          </Button>
        </>
      )}
      {needsIdentity && (
        <ButtonLink href="/app/kyc-tier1" variant="secondary">
          Re-verify identity (BVN &amp; NIN)
        </ButtonLink>
      )}
      {needsDocument && (
        <ButtonLink href="/app/kyc-tier2" variant="secondary">
          Re-upload document
        </ButtonLink>
      )}
    </Card>
  );
}

// Shown only before verification, and only with inputs for the fields that are
// still empty: the backend fills empty fields only and never overwrites.
function CompleteProfileCard({
  emptyFields,
  savedCountry,
  onSaved,
}: {
  emptyFields: { firstName: boolean; lastName: boolean; phoneNumber: boolean; country: boolean };
  // Country already on the account, if any: the phone field's dial code comes
  // from it when the country is not itself one of the fields being filled.
  savedCountry: string | null;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const { data: countryOptions } = useCountries();
  // Whichever is in play: the one being picked now, or the one on file.
  const phoneCountry = emptyFields.country ? country : savedCountry;

  const onSave = async () => {
    setNotice(null);
    const update: ProfileUpdate = {};
    if (emptyFields.firstName && firstName.trim()) update.firstName = firstName.trim();
    if (emptyFields.lastName && lastName.trim()) update.lastName = lastName.trim();
    if (emptyFields.phoneNumber && phoneNumber.trim()) {
      const e164 = toE164(phoneNumber, phoneCountry);
      if (!e164) {
        setNotice({
          title: "Check your phone number",
          body: "Select your country first, then enter your number without the country code.",
        });
        return;
      }
      update.phoneNumber = e164;
    }
    if (emptyFields.country && country) update.country = country;

    if (Object.keys(update).length === 0) {
      setNotice({ title: "Nothing to save", body: "Fill in a field to update your profile." });
      return;
    }
    setSaving(true);
    try {
      await updateProfile(update);
      await onSaved();
      toast("Your details were saved.");
    } catch (err) {
      setNotice({ title: "Could not update", body: friendlyErrorMessage(err, "Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
      >
        <h2 className="font-display text-lg font-semibold">Complete your profile</h2>
        <p className="text-sm text-muted">
          Add the missing details below. You can only set these before your identity is verified.
        </p>
        {emptyFields.firstName && (
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
        )}
        {emptyFields.lastName && (
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
        )}
        {/* Country sits above the phone field, which reads its dial code from it. */}
        {emptyFields.country && (
          <CountryPicker
            label="Country"
            options={countryOptions ?? []}
            value={country}
            onChange={(code) => {
              setCountry(code);
              setPhoneNumber((n) => nationalNumber(n, code));
            }}
          />
        )}
        {emptyFields.phoneNumber && (
          <PhoneInput
            country={phoneCountry}
            value={phoneNumber}
            onChangeText={(v) => setPhoneNumber(nationalNumber(v, phoneCountry))}
          />
        )}
        <NoticeAlert notice={notice} />
        <Button type="submit" loading={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}
