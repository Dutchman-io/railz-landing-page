"use client";

import { useId } from "react";
import { Field } from "@/components/ui/Field";
import { dialCodeFor } from "@/lib/phone";

/**
 * Phone entry split in two: a read-only dial code taken from the selected
 * country, and the national number. The dial code is not editable on purpose:
 * letting it be typed produces the "+234 0801..." numbers the API rejects.
 */
export function PhoneInput({
  label = "Phone number",
  country,
  value,
  onChangeText,
  error,
}: {
  label?: string;
  /** ISO 3166-1 alpha-2, from the country picker on the same form. */
  country: string | null;
  /** The national number only -- never the dial code. */
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
}) {
  const id = useId();
  const dial = dialCodeFor(country);
  const ready = !!dial;
  return (
    <Field label={label} error={error} htmlFor={id}>
      <div className="flex gap-2">
        <span className="input w-20 shrink-0 text-center text-muted tabular">{ready ? `+${dial}` : "+—"}</span>
        <input
          id={id}
          type="tel"
          autoComplete="tel-national"
          className="input"
          value={value}
          disabled={!ready}
          aria-invalid={!!error || undefined}
          placeholder={ready ? "801 234 5678" : "Select your country first"}
          onChange={(e) => onChangeText(e.target.value)}
        />
      </div>
    </Field>
  );
}
