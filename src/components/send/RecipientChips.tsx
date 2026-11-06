"use client";

import { useState } from "react";
import { deleteRecipient, type Recipient, useInvalidateRecipients } from "@/lib/recipients";
import { PromptModal, type PromptSpec } from "./PromptModal";

/**
 * A row of saved recipients to tap into the form. The × removes one, after
 * asking (mobile: long-press). Renders nothing when there is nothing saved,
 * so the form looks the same as before for a new user.
 */
export function RecipientChips({
  items,
  onSelect,
}: {
  items: Recipient[];
  onSelect: (recipient: Recipient) => void;
}) {
  const invalidate = useInvalidateRecipients();
  const [prompt, setPrompt] = useState<PromptSpec | null>(null);
  if (items.length === 0) return null;

  const remove = (recipient: Recipient) =>
    setPrompt({
      title: "Remove saved recipient?",
      message: `${recipient.label} will no longer be suggested here.`,
      buttons: [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void deleteRecipient(recipient.id).then(invalidate);
          },
        },
      ],
    });

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-muted">Saved</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((recipient) => (
          <div
            key={recipient.id}
            className="flex max-w-56 shrink-0 items-center rounded-full border border-border bg-background"
          >
            <button
              type="button"
              onClick={() => onSelect(recipient)}
              className="truncate py-2 pl-4 pr-2 text-sm font-semibold hover:text-primary"
            >
              {recipient.label}
            </button>
            <button
              type="button"
              onClick={() => remove(recipient)}
              aria-label={`Remove ${recipient.label}`}
              className="py-2 pl-1 pr-3 text-muted hover:text-danger"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <PromptModal prompt={prompt} onClose={() => setPrompt(null)} />
    </div>
  );
}
