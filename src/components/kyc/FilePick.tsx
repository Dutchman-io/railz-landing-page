"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ALLOWED_MIME } from "@/lib/kyc";

/** Images and PDFs, as the upload endpoint takes them. */
export const DOCUMENT_ACCEPT = ALLOWED_MIME.join(",");
/** Photos only: the selfie and anything mobile takes from the camera. */
export const IMAGE_ACCEPT = ALLOWED_MIME.filter((m) => m.startsWith("image/")).join(",");

/**
 * A button that opens the browser's file chooser. `capture` asks a phone to
 * open its camera instead ("user" front, "environment" back); desktops ignore it.
 */
export function FilePick({
  children,
  onFile,
  accept = DOCUMENT_ACCEPT,
  capture,
  variant = "secondary",
  size,
  loading,
  disabled,
  block,
  className,
}: {
  children: ReactNode;
  onFile: (file: File) => void;
  accept?: string;
  capture?: "user" | "environment";
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the same file again still fires a change.
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button
        variant={variant}
        size={size}
        loading={loading}
        disabled={disabled}
        block={block}
        className={className}
        onClick={() => ref.current?.click()}
      >
        {children}
      </Button>
    </>
  );
}
