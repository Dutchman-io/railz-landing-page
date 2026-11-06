"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { CountryPicker, type CountryOption } from "@/components/common/CountryPicker";
import { DateField } from "./DateField";
import { FilePick } from "./FilePick";
import { compressDocument } from "@/lib/compressImage";
import { ALL_COUNTRY_CODES, countryDisplayName } from "@/lib/countryDisplay";
import {
  isSupportedDocument,
  toLocalDocument,
  uploadFailureMessage,
  uploadKycDocument,
  type BusinessPerson,
  type BusinessVerification,
} from "@/lib/kyc";

/**
 * What a business adds for international verification: what it does, why it
 * sends money, where the money comes from, its incorporation papers, and the
 * people who own or run it. Our partner verifies a company through its owners
 * and controllers, each with their own ID.
 *
 * Every document is uploaded as it is picked; the form holds only the keys.
 */

const opt = (code: string, name: string): CountryOption => ({ code, name });

const BUSINESS_TYPES = [
  opt("LLC", "Limited liability company (Ltd)"),
  opt("CORPORATION", "Public company (Plc)"),
  opt("SOLE_PROPRIETORSHIP", "Sole proprietorship / business name"),
  opt("PARTNERSHIP", "Partnership"),
  opt("COOPERATIVE", "Cooperative"),
  opt("TRUST", "Trust"),
  opt("OTHER", "Other"),
];

const ACCOUNT_PURPOSES = [
  opt("PURCHASE_GOODS_AND_SERVICES", "Paying suppliers for goods and services"),
  opt("RECEIVE_PAYMENTS_FOR_GOODS_AND_SERVICES", "Receiving payments from customers"),
  opt("ECOMMERCE_RETAIL_PAYMENTS", "Online / retail sales"),
  opt("PAYROLL", "Paying staff"),
  opt("TREASURY_MANAGEMENT", "Managing company funds"),
  opt("INVESTMENT_PURPOSES", "Investments"),
  opt("CHARITABLE_DONATIONS", "Charitable donations"),
  opt("OTHER", "Something else"),
];

const SOURCES_OF_FUNDS = [
  opt("SALES_OF_GOODS_AND_SERVICES", "Sales of goods and services"),
  opt("OWNERS_CAPITAL", "Owners' capital"),
  opt("BUSINESS_LOANS", "Business loans"),
  opt("INVESTMENT_PROCEEDS", "Investment proceeds"),
  opt("INTER_COMPANY_FUNDS", "Funds from a related company"),
  opt("GRANTS", "Grants"),
  opt("SALE_OF_ASSETS", "Sale of assets"),
  opt("TREASURY_RESERVES", "Company reserves"),
];

const ID_TYPES = [opt("passport", "International passport"), opt("national_id", "National ID"), opt("drivers_license", "Driver's licence")];

interface PersonDraft {
  firstName: string;
  lastName: string;
  email: string;
  birthDate: string;
  streetLine1: string;
  city: string;
  country: string | null;
  idType: BusinessPerson["idType"] | null;
  idNumber: string;
  idIssuingCountry: string | null;
  idFrontStorageKey: string | null;
  idBackStorageKey: string | null;
  hasOwnership: boolean;
  hasControl: boolean;
  isSigner: boolean;
  title: string;
}

const emptyPerson = (): PersonDraft => ({
  firstName: "",
  lastName: "",
  email: "",
  birthDate: "",
  streetLine1: "",
  city: "",
  country: "NG",
  idType: null,
  idNumber: "",
  idIssuingCountry: "NG",
  idFrontStorageKey: null,
  idBackStorageKey: null,
  hasOwnership: true,
  hasControl: true,
  isSigner: true,
  title: "",
});

const latestAdultBirthday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
};

/** What is still missing, in the customer's words; empty when complete. */
const missingFrom = (
  form: {
    businessType: string | null;
    description: string;
    accountPurpose: string | null;
    accountPurposeOther: string;
    sourceOfFunds: string | null;
    formationKey: string | null;
    ownershipKey: string | null;
    attest: boolean;
  },
  people: PersonDraft[],
): string[] => {
  const missing: string[] = [];
  if (!form.businessType) missing.push("type of business");
  if (!form.description.trim()) missing.push("what the business does");
  if (!form.accountPurpose) missing.push("what you will use transfers for");
  if (form.accountPurpose === "OTHER" && !form.accountPurposeOther.trim()) {
    missing.push("a description of that purpose");
  }
  if (!form.sourceOfFunds) missing.push("where the money comes from");
  if (!form.formationKey) missing.push("incorporation certificate");
  if (!form.ownershipKey && !form.attest) {
    missing.push("a shareholder document, or confirmation of the owners");
  }
  if (!people.some((p) => p.hasControl)) missing.push("a person who runs the business");
  if (!people.some((p) => p.isSigner)) missing.push("a person who can approve payments");
  people.forEach((p, i) => {
    const who = p.firstName.trim() || `person ${i + 1}`;
    const gaps = [
      !p.firstName.trim() || !p.lastName.trim() ? "name" : "",
      !/^\S+@\S+\.\S+$/.test(p.email.trim()) ? "email" : "",
      !p.birthDate ? "date of birth" : "",
      p.streetLine1.trim().length < 4 || !p.city.trim() || !p.country ? "address" : "",
      !p.idType || !p.idNumber.trim() || !p.idIssuingCountry ? "ID details" : "",
      !p.idFrontStorageKey ? "ID photo" : "",
      p.hasControl && !p.title.trim() ? "job title" : "",
    ].filter(Boolean);
    if (gaps.length > 0) missing.push(`${who}'s ${gaps.join(", ")}`);
  });
  return missing;
};

/** One document to pick and upload. */
function DocRow({
  label,
  hint,
  value,
  busy,
  disabled,
  onFile,
}: {
  label: string;
  hint?: string;
  value: string | null;
  busy: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <FilePick variant={value ? "ghost" : "secondary"} loading={busy} disabled={disabled} onFile={onFile} className="self-start">
        {value ? "Added — replace" : "Add photo"}
      </FilePick>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="flex-1">{label}</span>
      <input type="checkbox" role="switch" checked={value} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-primary" />
    </label>
  );
}

export function BusinessVerificationForm({
  feeNote,
  submitting,
  error,
  onSubmit,
}: {
  /** "This costs 11 USDT, taken once…" — shown above the button, or null. */
  feeNote: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (business: BusinessVerification) => void;
}) {
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [accountPurpose, setAccountPurpose] = useState<string | null>(null);
  const [accountPurposeOther, setAccountPurposeOther] = useState("");
  const [sourceOfFunds, setSourceOfFunds] = useState<string | null>(null);
  const [formationKey, setFormationKey] = useState<string | null>(null);
  const [ownershipKey, setOwnershipKey] = useState<string | null>(null);
  const [natureKey, setNatureKey] = useState<string | null>(null);
  const [attest, setAttest] = useState(false);
  const [people, setPeople] = useState<PersonDraft[]>([emptyPerson()]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const countries = useMemo(() => ALL_COUNTRY_CODES.map((c) => opt(c, countryDisplayName(c))), []);

  const setPerson = (index: number, patch: Partial<PersonDraft>) =>
    setPeople((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  /** Upload a picked file and hand back our key — or null. */
  const upload = async (file: File, slot: string, subject: string): Promise<string | null> => {
    setUploadError(null);
    const doc = toLocalDocument(file);
    if (!isSupportedDocument(doc)) {
      setUploadError("That file type is not supported. Use a JPEG, PNG or WEBP photo.");
      return null;
    }
    setUploading(slot);
    try {
      const uploaded = await uploadKycDocument(await compressDocument(doc));
      return uploaded.storageKey;
    } catch (err) {
      setUploadError(uploadFailureMessage(err, { subject, plural: false }));
      return null;
    } finally {
      setUploading(null);
    }
  };

  /** A file handler that uploads into `slot` and stores the key with `save`. */
  const pickInto = (slot: string, subject: string, save: (key: string) => void) => async (file: File) => {
    const key = await upload(file, slot, subject);
    if (key) save(key);
  };

  const missing = missingFrom(
    { businessType, description, accountPurpose, accountPurposeOther, sourceOfFunds, formationKey, ownershipKey, attest },
    people,
  );

  const submit = () => {
    if (missing.length > 0 || !businessType || !accountPurpose || !sourceOfFunds || !formationKey) {
      return;
    }
    onSubmit({
      businessType,
      description: description.trim(),
      accountPurpose,
      accountPurposeOther: accountPurpose === "OTHER" ? accountPurposeOther.trim() : undefined,
      sourceOfFunds,
      formationDocumentStorageKey: formationKey,
      ownershipDocumentStorageKey: ownershipKey ?? undefined,
      natureOfBusinessDocumentStorageKey: natureKey ?? undefined,
      attestOwnershipStructure: attest || undefined,
      associatedPersons: people.map((p) => ({
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        email: p.email.trim(),
        birthDate: p.birthDate,
        address: {
          streetLine1: p.streetLine1.trim(),
          city: p.city.trim(),
          country: p.country ?? "NG",
        },
        idType: p.idType ?? "passport",
        idNumber: p.idNumber.trim(),
        idIssuingCountry: p.idIssuingCountry ?? "NG",
        idFrontStorageKey: p.idFrontStorageKey ?? "",
        idBackStorageKey: p.idBackStorageKey ?? undefined,
        hasOwnership: p.hasOwnership,
        hasControl: p.hasControl,
        isSigner: p.isSigner,
        title: p.hasControl ? p.title.trim() : undefined,
      })),
    });
  };

  const section = (text: string) => <h3 className="mt-3 font-display text-base font-semibold">{text}</h3>;

  return (
    <div className="flex flex-col gap-4">
      {section("About the business")}
      <CountryPicker label="Type of business" options={BUSINESS_TYPES} value={businessType} onChange={setBusinessType} placeholder="Choose one" />
      <Textarea
        label="What does the business do?"
        placeholder="We import and distribute consumer electronics."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={1000}
      />
      <CountryPicker
        label="What will you use international transfers for?"
        options={ACCOUNT_PURPOSES}
        value={accountPurpose}
        onChange={setAccountPurpose}
        placeholder="Choose one"
      />
      {accountPurpose === "OTHER" && (
        <Input label="Tell us more" value={accountPurposeOther} onChange={(e) => setAccountPurposeOther(e.target.value)} maxLength={500} />
      )}
      <CountryPicker
        label="Where does the business's money come from?"
        options={SOURCES_OF_FUNDS}
        value={sourceOfFunds}
        onChange={setSourceOfFunds}
        placeholder="Choose one"
      />

      {section("Documents")}
      <DocRow
        label="Certificate of incorporation"
        hint="Or your business name registration certificate."
        value={formationKey}
        busy={uploading === "formation"}
        disabled={uploading !== null}
        onFile={pickInto("formation", "Your certificate", setFormationKey)}
      />
      <DocRow
        label="Shareholder document (optional)"
        hint="A status report or register of shareholders."
        value={ownershipKey}
        busy={uploading === "ownership"}
        disabled={uploading !== null}
        onFile={pickInto("ownership", "Your shareholder document", setOwnershipKey)}
      />
      {!ownershipKey && <Toggle label="I confirm the people listed below are everyone who owns 25% or more" value={attest} onChange={setAttest} />}
      <DocRow
        label="Proof of what you do (if you have no website)"
        hint="An invoice, contract or brochure."
        value={natureKey}
        busy={uploading === "nature"}
        disabled={uploading !== null}
        onFile={pickInto("nature", "Your document", setNatureKey)}
      />

      {section("Owners and directors")}
      <p className="text-sm text-muted">Everyone who owns 25% or more, and at least one person who runs the business. Each needs their own ID.</p>
      {people.map((p, i) => (
        <div key={i} className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Person {i + 1}</p>
            {people.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setPeople((list) => list.filter((_, j) => j !== i))}>
                Remove
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First name" value={p.firstName} onChange={(e) => setPerson(i, { firstName: e.target.value })} />
            <Input label="Last name" value={p.lastName} onChange={(e) => setPerson(i, { lastName: e.target.value })} />
          </div>
          <Input label="Email" type="email" autoCapitalize="none" value={p.email} onChange={(e) => setPerson(i, { email: e.target.value })} />
          <DateField
            label="Date of birth"
            placeholder="Select date of birth"
            value={p.birthDate}
            onChange={(v) => setPerson(i, { birthDate: v })}
            maximumDate={latestAdultBirthday()}
          />
          <Input label="Home address" placeholder="12 Marina Road" value={p.streetLine1} onChange={(e) => setPerson(i, { streetLine1: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" value={p.city} onChange={(e) => setPerson(i, { city: e.target.value })} />
            <CountryPicker label="Country they live in" options={countries} value={p.country} onChange={(v) => setPerson(i, { country: v })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CountryPicker
              label="ID type"
              options={ID_TYPES}
              value={p.idType}
              onChange={(v) => setPerson(i, { idType: v as BusinessPerson["idType"] })}
              placeholder="Choose one"
            />
            <Input label="ID number" value={p.idNumber} onChange={(e) => setPerson(i, { idNumber: e.target.value })} />
          </div>
          <CountryPicker
            label="Country that issued the ID"
            options={countries}
            value={p.idIssuingCountry}
            onChange={(v) => setPerson(i, { idIssuingCountry: v })}
          />
          <DocRow
            label="Photo of the ID"
            hint="The photo page of a passport, or the front of a card."
            value={p.idFrontStorageKey}
            busy={uploading === `id-front-${i}`}
            disabled={uploading !== null}
            onFile={pickInto(`id-front-${i}`, "The ID photo", (key) => setPerson(i, { idFrontStorageKey: key }))}
          />
          {p.idType && p.idType !== "passport" && (
            <DocRow
              label="Back of the ID"
              value={p.idBackStorageKey}
              busy={uploading === `id-back-${i}`}
              disabled={uploading !== null}
              onFile={pickInto(`id-back-${i}`, "The back of the ID", (key) => setPerson(i, { idBackStorageKey: key }))}
            />
          )}
          <Toggle label="Owns 25% or more" value={p.hasOwnership} onChange={(v) => setPerson(i, { hasOwnership: v })} />
          <Toggle label="Runs the business (director or senior manager)" value={p.hasControl} onChange={(v) => setPerson(i, { hasControl: v })} />
          {p.hasControl && (
            <Input label="Job title" placeholder="Managing Director" value={p.title} onChange={(e) => setPerson(i, { title: e.target.value })} />
          )}
          <Toggle label="Can approve payments" value={p.isSigner} onChange={(v) => setPerson(i, { isSigner: v })} />
        </div>
      ))}
      {people.length < 10 && (
        <Button variant="ghost" onClick={() => setPeople((list) => [...list, { ...emptyPerson(), hasControl: false, isSigner: false }])}>
          Add another person
        </Button>
      )}

      <Alert>{uploadError}</Alert>
      {missing.length > 0 && <p className="text-sm text-warning">Still needed: {missing.join("; ")}.</p>}
      {feeNote && <p className="text-sm text-muted">{feeNote}</p>}
      <Alert>{error}</Alert>
      <Button loading={submitting} disabled={missing.length > 0 || submitting || uploading !== null} onClick={submit} block>
        Submit
      </Button>
    </div>
  );
}
