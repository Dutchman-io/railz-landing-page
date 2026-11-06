import type { ReactNode } from "react";

/** A small status pill: green when done, amber when something is pending. */
export function Badge({ tone, children }: { tone: "success" | "warning"; children: ReactNode }) {
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-background ${
        tone === "success" ? "bg-success" : "bg-warning"
      }`}
    >
      {children}
    </span>
  );
}
