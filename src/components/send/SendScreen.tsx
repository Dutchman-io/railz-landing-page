"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { useSendNetworks, type SendAsset } from "@/lib/send";
import { CryptoSend } from "./CryptoSend";
import { FiatSend } from "./FiatSend";
import { Segment } from "./Segment";

const MODES = [
  { value: "FIAT", label: "Fiat" },
  { value: "CRYPTO", label: "Ramp" },
] as const;

/** Send money: a fiat payout (own bank or abroad) or an on-chain send. */
export function SendScreen() {
  const { data } = useSendNetworks();
  const [sendMode, setSendMode] = useState<"CRYPTO" | "FIAT">("FIAT");

  // The coin the user picked, if any. Null until they choose: which coins
  // exist is the backend's to say, so there is nothing to default to before
  // its list arrives. Both modes send in it (a fiat payout is settled in the
  // stablecoin).
  const [picked, setPicked] = useState<SendAsset | null>(null);
  const assets = useMemo<SendAsset[]>(() => data?.assets ?? [], [data]);
  // The selection, held to whatever is actually on offer. Derived rather than
  // corrected in an effect, so a coin the admin turns off is never selected.
  const asset = picked && assets.includes(picked) ? picked : (assets[0] ?? "");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader
        title="Send money"
        subtitle="Withdraw to your own bank account, pay someone abroad, or send crypto to a wallet address."
      />
      <Card>
        <Segment label="Transfer Type" options={MODES} value={sendMode} onChange={setSendMode} />
      </Card>
      {sendMode === "FIAT" ? (
        <FiatSend asset={asset} />
      ) : (
        <CryptoSend data={data} assets={assets} asset={asset} onAsset={setPicked} />
      )}
    </div>
  );
}
