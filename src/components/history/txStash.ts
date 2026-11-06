import type { LedgerActivity } from "@/lib/wallet";

/*
 * Mobile hands the detail screen the whole entry as a route param; there is no
 * endpoint for one transaction. The web keeps that payload in sessionStorage
 * instead of the URL, so the detail page survives a reload in the same tab.
 */
const key = (id: string) => `zemfi-tx:${id}`;

export function stashTransaction(tx: LedgerActivity): void {
  try {
    sessionStorage.setItem(key(tx.id), JSON.stringify(tx));
  } catch {
    // Storage blocked: the detail page falls back to the loaded history.
  }
}

export function readStashedTransaction(id: string): LedgerActivity | null {
  try {
    const raw = sessionStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as LedgerActivity) : null;
  } catch {
    return null;
  }
}
