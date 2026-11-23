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
  tokens: icon("M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM18.1 10.4a6 6 0 1 1-7.7 7.7M7 7h2v4"),
  bills: icon("M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6"),
  bank: icon("M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M12 3 3 8h18l-9-5Z"),
};

const tile =
  "group flex flex-col items-center gap-2.5 rounded-3xl border border-border/70 bg-surface px-2 py-5 text-sm font-semibold shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40";

/**
 * Each action in its own colour, so the row reads at a glance: earthy tones
 * that sit with the warm palette, the brand ink blue for Send.
 */
const HUES: Record<string, string> = {
  Send: "from-[#2b78ad] to-[#1f5f8b] shadow-[#1f5f8b]/30",
  Receive: "from-[#4a9a76] to-[#2e7d5b] shadow-[#2e7d5b]/30",
  Convert: "from-[#8a6aa3] to-[#6b4f85] shadow-[#6b4f85]/30",
  Tokens: "from-[#d39a4a] to-[#b26a00] shadow-[#b26a00]/30",
  Bills: "from-[#c8714f] to-[#a4502f] shadow-[#a4502f]/30",
};

/** One action tile: a link, or a button when the capability is coming soon. */
export function ActionTile({ href, label, icon, soon, onSoon }: { href: string; label: string; icon: ReactNode; soon?: boolean; onSoon?: () => void }) {
  const body = (
    <>
      <span
        className={`flex size-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${
          soon ? "bg-wash text-muted" : `bg-gradient-to-br text-white shadow-lg ${HUES[label] ?? HUES.Send}`
        }`}
      >
        {icon}
      </span>
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
