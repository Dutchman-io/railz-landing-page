"use client";

import { Select } from "@/components/ui/Field";
import type { CurrencyMeta } from "@/lib/currency";

/** Pick a currency from the catalogue the backend serves. */
export function CurrencyPicker({
  options,
  value,
  onChange,
  label,
}: {
  options: CurrencyMeta[];
  value: string | null;
  onChange: (code: string) => void;
  label?: string;
}) {
  if (options.length === 0) return null;
  return (
    <Select label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {value === null && (
        <option value="" disabled>
          Choose a currency
        </option>
      )}
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.code} · {o.name}
        </option>
      ))}
    </Select>
  );
}
