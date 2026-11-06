"use client";

import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { PAYMENT_PURPOSE_LABEL, PURPOSE_NOTE_MAX, PURPOSE_NOTE_MIN } from "@/lib/globalSend";
import type { PaymentPurpose } from "@/types/api";
import { OptionItem, PickerTrigger } from "./OptionList";

/** Reason for payment: asked on every cross-border send. */
export function PurposeSection({
  purpose,
  options,
  note,
  error,
  pickerOpen,
  onPickerOpen,
  onPick,
  onNote,
}: {
  purpose: PaymentPurpose | null;
  options: readonly { value: PaymentPurpose; label: string }[];
  note: string;
  /** The server's words when it refused the send for its reason. */
  error: string | null;
  pickerOpen: boolean;
  onPickerOpen: (open: boolean) => void;
  onPick: (purpose: PaymentPurpose) => void;
  onNote: (note: string) => void;
}) {
  const noteLength = note.trim().length;
  return (
    <>
      <PickerTrigger
        label="Reason for payment"
        value={purpose ? PAYMENT_PURPOSE_LABEL[purpose] : null}
        placeholder="Choose a reason"
        error={!!error}
        onClick={() => onPickerOpen(true)}
        ariaLabel={
          purpose ? `Reason for payment: ${PAYMENT_PURPOSE_LABEL[purpose]}` : "Choose a reason for payment"
        }
      />
      {error && purpose !== "OTHER" && <p className="-mt-2 text-sm text-danger">{error}</p>}
      <Modal open={pickerOpen} onClose={() => onPickerOpen(false)} title="Reason for payment">
        {options.map((option) => (
          <OptionItem
            key={option.value}
            active={option.value === purpose}
            onClick={() => {
              onPick(option.value);
              onPickerOpen(false);
            }}
          >
            {option.label}
          </OptionItem>
        ))}
      </Modal>
      {purpose === "OTHER" && (
        <Input
          label="Describe the reason"
          placeholder="e.g. Deposit for a shipment"
          value={note}
          onChange={(e) => onNote(e.target.value)}
          maxLength={PURPOSE_NOTE_MAX}
          error={error}
        />
      )}
      {!purpose && !error && <p className="text-sm text-warning">Choose a reason for this payment to continue.</p>}
      {purpose === "OTHER" && !error && noteLength < PURPOSE_NOTE_MIN && (
        <p className="text-sm text-warning">Describe the reason in at least {PURPOSE_NOTE_MIN} characters.</p>
      )}
    </>
  );
}
