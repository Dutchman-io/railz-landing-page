"use client";

import { Select } from "@/components/ui/Field";

export interface CountryOption {
  code: string;
  name: string;
}

/**
 * Country dropdown. A native <select> is searchable by typing in every
 * browser, which is what the mobile app's searchable dropdown provides.
 */
export function CountryPicker({
  label,
  options,
  value,
  onChange,
  placeholder = "Select your country",
  error,
}: {
  label?: string;
  options: CountryOption[];
  value: string | null;
  onChange: (code: string) => void;
  placeholder?: string;
  error?: string | null;
}) {
  return (
    <Select label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} error={error}>
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.name}
        </option>
      ))}
    </Select>
  );
}
