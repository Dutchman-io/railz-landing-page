"use client";

import Link from "next/link";
import { toNetworkOptions, useDepositNetworks } from "@/lib/depositNetworks";
import { useRate } from "@/lib/rates";
import { formatMoney } from "@/lib/currency";
import type { BlockchainNetwork } from "@/types/api";

/**
 * Today's buy and sell rate for one unit of a stablecoin in the user's own
 * currency, kept fresh on the same 15-second tick the converter uses.
 * Clicking opens the converter. Renders nothing until a rate exists, so a user
 * in a country with no live rail sees no empty strip.
 *
 * `asset` is the stablecoin the balance card is showing. Without one, or when
 * that coin cannot be priced just now, it prices the server's default instead.
 * The coin is named by the response: whatever the server priced is what the
 * label says. (Ported from zemfi-mobile.)
 */
export function RateStrip({ asset }: { asset?: string }) {
  const { data: networks } = useDepositNetworks();
  const network = (toNetworkOptions(networks)[0]?.value ?? "tron") as BlockchainNetwork;
  const chosen = useRate(network, asset, { enabled: Boolean(asset) });
  const fallback = useRate(network, undefined, { enabled: !asset || chosen.isError });
  const live = asset && chosen.data ? chosen : fallback;
  const { data: rate, isFetching } = live;
  if (!rate) return null;
  const priced = rate.asset ?? "USDT";

  return (
    <Link
      href="/app/convert"
      aria-label="Open the converter"
      className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:border-primary"
    >
      <div className="flex-1">
        <p className="text-xs text-muted">Buy {priced}</p>
        <p className="font-semibold tabular">{formatMoney(rate.buyRate, rate.fiatCurrency)}</p>
      </div>
      <div className="h-7 w-px bg-border" />
      <div className="flex-1">
        <p className="text-xs text-muted">Sell {priced}</p>
        <p className="font-semibold tabular">{formatMoney(rate.sellRate, rate.fiatCurrency)}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${isFetching ? "bg-subtle" : "bg-success"}`} />
        <span className="text-xs text-subtle">{isFetching ? "Updating" : "Live"}</span>
      </div>
    </Link>
  );
}
