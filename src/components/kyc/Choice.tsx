"use client";

/**
 * A row of mutually exclusive options (Personal / Business, Yes / No, which
 * ID document). `value` may be null when nothing is chosen yet: some answers
 * must not be defaulted.
 */
export function Choice<T extends string | boolean>({
  options,
  value,
  onChange,
  label,
  disabled,
  wrap = false,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label?: string;
  disabled?: boolean;
  /** Pills that wrap, rather than equal-width segments. */
  wrap?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={wrap ? "flex flex-wrap gap-2" : "flex gap-2"}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`${wrap ? "rounded-full px-3.5 py-1.5 text-sm" : "h-11 flex-1 rounded-xl"} border font-medium transition-colors disabled:opacity-50 ${
              active ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-muted hover:border-primary hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
