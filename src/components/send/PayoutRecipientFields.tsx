"use client";

import { Input } from "@/components/ui/Field";
import type { RecipientField } from "@/lib/globalSend";
import { ChinaSupplierFields, type ChinaSupplierDetails } from "./ChinaSupplierFields";
import { RecipientSchemaFields, type RecipientValues } from "./RecipientSchemaFields";
import { Segment } from "./Segment";
import {
  FIXED_FORM_COUNTRIES,
  accountNumberLabel,
  accountNumberPlaceholder,
  type PayoutFields,
} from "./payout";

const RAILS = [
  { value: "ACH", label: "ACH Direct Deposit" },
  { value: "WIRE", label: "Wire Transfer" },
] as const;

/** The recipient's details for a payout to someone else, by destination. */
export function PayoutRecipientFields({
  targetCountry,
  currency,
  fields,
  onChange,
  needsName,
  addressFields,
  recipientSchema,
  recipientValues,
  onRecipientValues,
  isChinaSupplier,
  china,
  onChina,
  ownAccount,
}: {
  ownAccount: boolean;
  targetCountry: string;
  currency?: string;
  fields: PayoutFields;
  onChange: (patch: Partial<PayoutFields>) => void;
  needsName: boolean;
  addressFields: string[];
  recipientSchema?: RecipientField[];
  recipientValues: RecipientValues;
  onRecipientValues: (next: RecipientValues) => void;
  isChinaSupplier: boolean;
  china: ChinaSupplierDetails;
  onChina: (next: ChinaSupplierDetails) => void;
}) {
  const text = (key: keyof Omit<PayoutFields, "usPaymentRail">) => ({
    value: fields[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [key]: e.target.value }),
  });
  const fixed = FIXED_FORM_COUNTRIES.includes(targetCountry);

  return (
    <>
      {targetCountry === "US" && (
        <>
          <Segment
            label="US Payment Method"
            options={RAILS}
            value={fields.usPaymentRail}
            onChange={(usPaymentRail) => onChange({ usPaymentRail })}
          />
          <Input label="Beneficiary Full Name" placeholder="e.g. John Doe" {...text("beneficiaryName")} />
          <Input
            label="Routing Number (ABA)"
            placeholder="9-digit ABA routing number"
            inputMode="numeric"
            maxLength={9}
            {...text("routingNumber")}
          />
          <Input
            label="Account Number"
            placeholder="US Bank Account Number"
            inputMode="numeric"
            {...text("accountNumber")}
          />
        </>
      )}

      {targetCountry === "GB" && (
        <>
          <Input label="Beneficiary Full Name" placeholder="e.g. Jane Smith" {...text("beneficiaryName")} />
          <Input
            label="Sort Code"
            placeholder="6-digit sort code (e.g. 123456)"
            inputMode="numeric"
            maxLength={6}
            {...text("sortCode")}
          />
          <Input
            label="Account Number"
            placeholder="8-digit UK account number"
            inputMode="numeric"
            maxLength={8}
            {...text("accountNumber")}
          />
        </>
      )}

      {targetCountry === "CA" && (
        <>
          <Input label="Beneficiary Full Name" placeholder="e.g. Robert Tremblay" {...text("beneficiaryName")} />
          <Input
            label="Institution Number"
            placeholder="3-digit institution code (e.g. 004)"
            inputMode="numeric"
            maxLength={3}
            {...text("institutionNumber")}
          />
          <Input
            label="Transit Number"
            placeholder="5-digit branch transit code"
            inputMode="numeric"
            maxLength={5}
            {...text("transitNumber")}
          />
          <Input
            label="Account Number"
            placeholder="Canadian bank account number"
            inputMode="numeric"
            {...text("accountNumber")}
          />
        </>
      )}

      {/* China pays into a bank account in the recipient's name: the name as
          the bank holds it, the bank, and the card or account number. Alipay
          and WeChat IDs are not bank accounts. */}
      {targetCountry === "CN" && (
        <>
          <Input
            label="Recipient's full name"
            placeholder="As it appears on the bank account"
            {...text("beneficiaryName")}
          />
          <Input label="Bank name" placeholder="e.g. Bank of China" {...text("recipientBank")} />
          <Input
            label="Bank card or account number"
            placeholder="UnionPay card or bank account number"
            inputMode="numeric"
            {...text("accountNumber")}
          />
          {isChinaSupplier && <ChinaSupplierFields value={china} onChange={onChina} />}
        </>
      )}

      {/* Every corridor beyond the four above falls here: the corridor's own
          form when it has one, else a name and the rail's account field. */}
      {recipientSchema && !fixed && (
        <RecipientSchemaFields schema={recipientSchema} values={recipientValues} onChange={onRecipientValues} />
      )}
      {!ownAccount && !recipientSchema && !fixed && (
        <>
          {needsName && (
            <Input label="Beneficiary Full Name" placeholder="Full name on the account" {...text("beneficiaryName")} />
          )}
          <Input
            label={accountNumberLabel(currency)}
            placeholder={accountNumberPlaceholder(currency)}
            autoCapitalize="none"
            autoCorrect="off"
            {...text("accountNumber")}
          />
        </>
      )}

      {/* The recipient's own address, where the corridor's partner needs it to
          register the account. Asked here so the send is never paid for and
          then stopped for want of it. */}
      {addressFields.length > 0 && (
        <>
          <p className="text-sm font-semibold text-muted">Recipient&apos;s address</p>
          {addressFields.includes("street") && (
            <Input label="Street address" placeholder="e.g. 500 Broadway" {...text("street")} />
          )}
          {addressFields.includes("city") && <Input label="City" placeholder="e.g. New York" {...text("city")} />}
          {addressFields.includes("state") && (
            <Input label="State" placeholder="e.g. NY" autoCapitalize="characters" {...text("state")} />
          )}
          <Input
            label={addressFields.includes("postalCode") ? "Postal code" : "Postal code (optional)"}
            placeholder="e.g. 10012"
            {...text("postal")}
          />
        </>
      )}
    </>
  );
}
