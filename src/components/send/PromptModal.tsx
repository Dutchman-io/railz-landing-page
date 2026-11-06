"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * What mobile's Alert.alert(title, message, buttons) did: a title, a
 * sentence, and a row of choices. Every choice closes the prompt; one with
 * no `onPress` only closes it. No buttons means a single "OK".
 */
export interface PromptSpec {
  title: string;
  message: string;
  buttons?: {
    text: string;
    style?: "cancel" | "destructive";
    onPress?: () => void;
  }[];
}

export function PromptModal({
  prompt,
  onClose,
}: {
  prompt: PromptSpec | null;
  onClose: () => void;
}) {
  const buttons = prompt?.buttons?.length ? prompt.buttons : [{ text: "OK" }];
  // The primary choice leads; "cancel" ones sit under it, quieter.
  const ordered = [
    ...buttons.filter((b) => b.style !== "cancel"),
    ...buttons.filter((b) => b.style === "cancel"),
  ];
  return (
    <Modal
      open={prompt !== null}
      onClose={onClose}
      title={prompt?.title}
      footer={ordered.map((b, i) => (
        <Button
          key={b.text}
          variant={
            b.style === "destructive"
              ? "danger"
              : b.style === "cancel" || i > 0
                ? "ghost"
                : "primary"
          }
          onClick={() => {
            onClose();
            b.onPress?.();
          }}
        >
          {b.text}
        </Button>
      ))}
    >
      <p className="text-sm text-muted">{prompt?.message}</p>
    </Modal>
  );
}
