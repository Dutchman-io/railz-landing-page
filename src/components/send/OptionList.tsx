"use client";

import type { ReactNode } from "react";

/** A dropdown-style trigger: the current choice and a chevron. */
export function PickerTrigger({
  label,
  value,
  placeholder,
  error,
  onClick,
  ariaLabel,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  error?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`input flex items-center justify-between gap-3 text-left ${error ? "border-danger" : ""}`}
      >
        <span className={value ? "" : "text-muted"}>{value ?? placeholder}</span>
        <span aria-hidden="true" className="text-xs text-muted">
          ▼
        </span>
      </button>
    </div>
  );
}

/** One choice in a picker modal, with a check on the active one. */
export function OptionItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-wash ${
        active ? "bg-wash font-semibold text-primary" : ""
      }`}
    >
      <span>{children}</span>
      {active && <span aria-hidden="true">✓</span>}
    </button>
  );
}
