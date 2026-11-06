import type { TimelineStep } from "@/lib/timeline";

const DOT: Record<TimelineStep["state"], string> = {
  done: "border-success bg-success",
  current: "border-warning bg-background",
  failed: "border-danger bg-danger",
  todo: "border-border bg-wash",
};

/** Vertical step list for a transaction's journey. (Ported from zemfi-mobile.) */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol>
      {steps.map((step, index) => (
        <li key={step.label} className="flex min-h-11 gap-3">
          <div className="flex w-4 flex-col items-center">
            <span className={`mt-1 size-3 shrink-0 rounded-full border-2 ${DOT[step.state]}`} />
            {index < steps.length - 1 && (
              <span className={`my-0.5 w-0.5 flex-1 ${step.state === "done" ? "bg-success" : "bg-border"}`} />
            )}
          </div>
          <div className="flex-1 pb-3">
            <p
              className={`font-semibold ${step.state === "todo" ? "text-subtle" : step.state === "failed" ? "text-danger" : ""}`}
            >
              {step.label}
            </p>
            {step.note && <p className="text-sm text-muted">{step.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
