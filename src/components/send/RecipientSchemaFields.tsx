"use client";

import { Input, Select } from "@/components/ui/Field";
import type { GlobalSendBeneficiary, RecipientField, RecipientFieldKey } from "@/lib/globalSend";

/** The values typed into a recipient form, by field key. */
export type RecipientValues = Partial<Record<RecipientFieldKey, string>>;

/** What is still missing or malformed, as the server checks it before the
 * debit (recipient-schemas.ts there): the same words, the same rules. */
export const recipientProblems = (schema: RecipientField[], values: RecipientValues): string[] =>
  schema.flatMap((field) => {
    const raw = values[field.key]?.trim() ?? "";
    if (!raw) return field.required ? [field.label.toLowerCase()] : [];
    if (field.pattern && !new RegExp(`^(?:${field.pattern})$`).test(raw)) {
      return [`${field.label.toLowerCase()}${field.patternHint ? ` (${field.patternHint})` : ""}`];
    }
    if (field.options && !field.options.includes(raw)) {
      return [`${field.label.toLowerCase()} (choose one from the list)`];
    }
    return [];
  });

/** The beneficiary a form's values make: only what was filled in. */
export const recipientBeneficiary = (values: RecipientValues): GlobalSendBeneficiary => {
  const pick = (key: RecipientFieldKey) => values[key]?.trim() || undefined;
  return {
    accountHolderName: pick("accountHolderName") ?? "",
    // A form that pays by IBAN (UAE) asks for no account number; the IBAN
    // stands in, and the server sends the IBAN alone.
    accountNumber: pick("accountNumber") ?? pick("iban") ?? "",
    bankName: pick("bankName"),
    bankCode: pick("bankCode"),
    phone: pick("phone"),
    iban: pick("iban"),
    swiftCode: pick("swiftCode"),
    nationalIdNumber: pick("nationalIdNumber"),
    nameInLocalLanguage: pick("nameInLocalLanguage"),
  };
};

const INPUT_MODE = {
  default: undefined,
  number: "numeric",
  phone: "tel",
} as const;

/**
 * A recipient form drawn from the corridor's own description, so a country
 * the server adds needs no app release. A field with `options` (a provider's
 * list of bank names) is a picker; the rest are text fields.
 */
export function RecipientSchemaFields({
  schema,
  values,
  onChange,
}: {
  schema: RecipientField[];
  values: RecipientValues;
  onChange: (next: RecipientValues) => void;
}) {
  const set = (key: RecipientFieldKey, value: string) => onChange({ ...values, [key]: value });

  return (
    <>
      {schema.map((field) =>
        field.options?.length ? (
          <Select
            key={field.key}
            label={field.label}
            value={values[field.key] ?? ""}
            onChange={(e) => set(field.key, e.target.value)}
          >
            <option value="" disabled>
              {field.placeholder ?? "Choose…"}
            </option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            key={field.key}
            label={field.label}
            placeholder={field.placeholder}
            inputMode={INPUT_MODE[field.keyboard ?? "default"]}
            type={field.keyboard === "phone" ? "tel" : "text"}
            autoCapitalize={field.key === "accountHolderName" ? "words" : "none"}
            autoCorrect="off"
            value={values[field.key] ?? ""}
            onChange={(e) => set(field.key, e.target.value)}
          />
        ),
      )}
    </>
  );
}
