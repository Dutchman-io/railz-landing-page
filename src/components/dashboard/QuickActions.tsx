"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { featureState, type Feature, type FeatureKey } from "@/lib/features";

const icon = (d: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const ICONS = {
  send: icon("M5 12h14M13 6l6 6-6 6"),
  receive: icon("M19 12H5M11 6l-6 6 6 6"),
  convert: icon("M7 7h11l-3-3M17 17H6l3 3"),
  tokens: icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v10M9 9.5c0-1 1.3-1.8 3-1.8s3 .8 3 1.8-1.3 1.6-3 2-3 1-3 2 1.3 1.8 3 1.8 3-.8 3-1.8"),
  bills: icon("M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6"),
  bank: icon("M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M12 3 3 8h18l-9-5Z"),
};

const tile =
  "flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-2 py-4 text-sm font-medium transition-colors hover:border-primary";

/** One action tile: a link, or a button when the capability is coming soon. */
export function ActionTile({ href, label, icon, soon, onSoon }: { href: string; label: string; icon: ReactNode; soon?: boolean; onSoon?: () => void }) {
  const body = (
    <>
      <span className={`flex size-11 items-center justify-center rounded-full ${soon ? "bg-wash text-muted" : "bg-wash text-primary"}`}>{icon}</span>
      <span className={soon ? "text-muted" : ""}>{label}</span>
      {soon && <span className="-mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-subtle">Soon</span>}
    </>
  );
  if (soon)
    return (
      <button type="button" onClick={onSoon} className={tile}>
        {body}
      </button>
    );
  return (
    <Link href={href} className={tile}>
      {body}
    </Link>
  );
}

/**
 * A dashboard action that respects the capability's state.
 *
 * OFF disappears. COMING_SOON stays, badged and quieter, and explains itself
 * when clicked. A route serving several capabilities shows unless EVERY one
 * of them is OFF. (Ported from zemfi-mobile's FeatureAction.)
 */
export function FeatureAction({
  features,
  featureKey,
  label,
  href,
  icon,
}: {
  features: Feature[] | undefined;
  featureKey: FeatureKey | FeatureKey[];
  label: string;
  href: string;
  icon: ReactNode;
}) {
  const [explaining, setExplaining] = useState(false);
  const keys = Array.isArray(featureKey) ? featureKey : [featureKey];
  const states = keys.map((key) => featureState(features, key));
  if (states.every((s) => s.status === "OFF")) return null;

  const live = states.find((s) => s.status === "LIVE");
  const state = live ?? states[0];
  const soon = !live && states.some((s) => s.status === "COMING_SOON");
  return (
    <>
      <ActionTile href={href} label={label} icon={icon} soon={soon} onSoon={() => setExplaining(true)} />
      {soon && (
        <Modal open={explaining} onClose={() => setExplaining(false)} title={label} footer={<Button onClick={() => setExplaining(false)}>OK</Button>}>
          <p className="text-muted">
            {state.message?.trim() || "This is not available yet. We will let you know when it is."}
          </p>
        </Modal>
      )}
    </>
  );
}
