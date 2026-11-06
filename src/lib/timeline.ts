// Where a transaction is on its way, as a short list of steps. Derived from
// the ledger entry's reason + status only, so the detail screen can draw it
// without another request; a push or refetch moves it along.
import { LedgerActivity } from "./wallet";

export type StepState = "done" | "current" | "failed" | "todo";

export interface TimelineStep {
  label: string;
  /** One line under the label; the current step says what to expect. */
  note?: string;
  state: StepState;
}

const TERMINAL_OK = new Set(["COMPLETED", "CONFIRMED"]);

const build = (
  labels: readonly [string, string, string],
  notes: readonly [string, string, string],
  status: LedgerActivity["status"],
): TimelineStep[] => {
  // Which of the three steps we are on: 0 submitted, 1 in flight, 2 done.
  const done = TERMINAL_OK.has(status);
  const failed = status === "FAILED";
  const inFlight = !done && !failed;
  return [
    { label: labels[0], note: notes[0], state: "done" },
    {
      label: labels[1],
      note: inFlight ? notes[1] : undefined,
      state: done ? "done" : failed ? "failed" : "current",
    },
    {
      label: failed ? "Failed" : labels[2],
      note: done
        ? notes[2]
        : failed
          ? "The amount is back on your balance."
          : undefined,
      state: done ? "done" : failed ? "failed" : "todo",
    },
  ];
};

/** Null for entries that happen in one step (deposits, conversions). */
export const timelineFor = (tx: LedgerActivity): TimelineStep[] | null => {
  switch (tx.reason) {
    case "withdrawal":
      return build(
        ["Submitted", "Sent to the bank", "Delivered"],
        [
          "We reserved the amount on your balance.",
          tx.status === "PENDING_LIQUIDITY"
            ? "Queued while we top up the payout float. Usually under an hour."
            : "Banks can take a few minutes to show it.",
          "The bank confirmed the payout.",
        ],
        tx.status,
      );
    case "crypto_send":
      return build(
        ["Submitted", "Broadcast", "Confirmed"],
        [
          "We reserved the amount on your balance.",
          tx.status === "BROADCASTING"
            ? "Waiting for the network to confirm. Usually a few minutes."
            : "Signing and sending to the network.",
          "Confirmed on-chain.",
        ],
        tx.status,
      );
    default:
      return null;
  }
};
