"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * A dialog on the native <dialog> element: focus trapping, Escape to close
 * and the backdrop come from the browser. Bottom sheet on phones, centred
 * card on wider screens.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="flex max-h-[85dvh] flex-col">
        {title && (
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-m-2 p-2 text-muted hover:text-foreground">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-col gap-2 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </dialog>
  );
}
