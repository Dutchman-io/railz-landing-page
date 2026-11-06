"use client";

/** A two-or-more way switch, the mobile screens' segment control. */
export function Segment<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <p className="text-sm font-medium">{label}</p>}
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl border border-border bg-background p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-primary text-on-primary" : "text-muted hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
