"use client";

import type { NetworkOption } from "@/lib/networks";

/** A row of equal-width options, one selected: the mode tabs and toggles. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "md" | "sm";
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-full border border-border bg-wash p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-full font-semibold transition-colors ${
              size === "sm" ? "py-1.5 text-sm" : "py-2.5"
            } ${active ? "bg-primary text-on-primary" : "text-muted hover:text-foreground"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** One choice among several, shown as a rounded chip. */
export function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        selected ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-muted hover:border-primary hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

/** Chips for choosing a blockchain network. Shared by the deposit and sell flows. */
export function NetworkPicker({
  options,
  value,
  onChange,
}: {
  options: NetworkOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Pill key={o.value} label={o.label} selected={o.value === value} onClick={() => onChange(o.value)} />
      ))}
    </div>
  );
}
