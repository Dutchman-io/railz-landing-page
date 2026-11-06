import { NO_HIDDEN_FEES_NOTE } from "@/lib/fees";

/** The shared "no hidden fees" line, under the fee lines it vouches for. */
export function NoHiddenFees({ className = "" }: { className?: string }) {
  return <p className={`text-xs text-muted ${className}`}>{NO_HIDDEN_FEES_NOTE}</p>;
}
