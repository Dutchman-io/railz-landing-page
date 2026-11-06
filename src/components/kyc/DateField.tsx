"use client";

import { Input } from "@/components/ui/Field";

// Local calendar parts, not toISOString(): local midnight in UTC can be the
// evening before.
const toIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * A date is picked with the browser's own calendar. The value stays
 * yyyy-mm-dd (what <input type="date"> uses natively) so callers validate and
 * submit it exactly as on mobile. (Ported from zemfi-mobile's DateField.)
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  error,
  disabled,
}: {
  label: string;
  /** yyyy-mm-dd, or "" when nothing has been picked yet. */
  value: string;
  onChange: (value: string) => void;
  /** Kept for parity with mobile; a date input shows its own format hint. */
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string | null;
  disabled?: boolean;
}) {
  return (
    <Input
      type="date"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={minimumDate ? toIso(minimumDate) : undefined}
      max={maximumDate ? toIso(maximumDate) : undefined}
      error={error}
      disabled={disabled}
    />
  );
}
