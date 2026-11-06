"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { NoHiddenFees } from "./NoHiddenFees";

export type ReviewRow = readonly [label: string, value: string];

/**
 * The last look before money moves: every number the user is about to commit
 * to, then one button. Closes itself when the confirm handler settles; the
 * caller shows its own success or error.
 */
export function ReviewSheet({
  visible,
  title,
  rows,
  note,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  rows: ReviewRow[];
  /** What happens next, e.g. how long delivery takes. */
  note?: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Modal
      open={visible}
      onClose={busy ? () => {} : onClose}
      title={title}
      footer={
        <>
          <Button onClick={() => void confirm()} loading={busy}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Go back
          </Button>
        </>
      }
    >
      <p className="mb-2 text-xs font-semibold tracking-widest text-muted">REVIEW</p>
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-right text-sm font-semibold tabular break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <NoHiddenFees className="mt-3" />
      {note && <p className="mt-3 text-sm text-muted">{note}</p>}
    </Modal>
  );
}
