"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/** A button that opens the browser's file chooser (or, with `capture`, the
 * phone's camera) and hands back the one file picked. */
export function FilePickButton({
  accept,
  capture,
  onFile,
  loading,
  disabled,
  variant = "secondary",
  children,
}: {
  accept: string;
  capture?: "environment" | "user";
  onFile: (file: File) => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "secondary" | "ghost";
  children: ReactNode;
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
          // Cleared so picking the same file again still fires a change.
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button
        variant={variant}
        size="sm"
        loading={loading}
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="flex-1"
      >
        {children}
      </Button>
    </>
  );
}
