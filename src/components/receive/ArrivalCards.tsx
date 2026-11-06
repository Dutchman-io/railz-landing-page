"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { NetworkPicker } from "@/components/convert/Chips";
import { AddressQr } from "./AddressQr";
import { useDepositAddresses, useVirtualAccount, initiateFundingCharge, type FundingCharge } from "@/lib/wallet";
import { currencyName } from "@/lib/currency";
import { networkLabel } from "@/lib/networks";
import { toNetworkOptions, useDepositNetworks } from "@/lib/depositNetworks";
import { friendlyErrorMessage } from "@/lib/api";
import { useActionReference } from "@/lib/idempotency";

/**
 * How money arrives, one card per rail. Which card a currency gets is not a
 * choice: a currency has a persistent account, or it collects per payment, or
 * it is on-chain. The rail decides.
 */

function useCopy() {
  const toast = useToast();
  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied");
    } catch {
      toast("Could not copy. Select the text and copy it instead.", "danger");
    }
  };
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-widest text-primary">{children}</p>
);

function AccountBlock({ bank, number, name }: { bank?: string | null; number: string; name?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted">{bank}</p>
      <p className="select-all font-display text-3xl font-bold tracking-wide tabular">{number}</p>
      <p className="font-medium">{name}</p>
    </div>
  );
}

/** Persistent virtual account (NGN/GHS/KES/TZS) — reused for every payment. */
export function VirtualAccountCard({ currency }: { currency: string }) {
  const { data: account, isLoading, error } = useVirtualAccount();
  const copy = useCopy();
  return (
    <Card className="flex flex-col gap-4">
      <Eyebrow>Your dedicated {currency} account</Eyebrow>
      {isLoading ? (
        <p className="text-sm text-muted">Setting up your account…</p>
      ) : account ? (
        <>
          <AccountBlock bank={account.bankName} number={account.accountNumber} name={account.accountName} />
          <Button variant="secondary" onClick={() => void copy(account.accountNumber)}>
            Copy account number
          </Button>
          <p className="text-sm text-muted">
            Transfer {currencyName(currency)} to this account from any bank. Your balance updates automatically once it arrives.
          </p>
        </>
      ) : (
        <Alert tone="warning">{friendlyErrorMessage(error, "Complete verification to get a funding account.")}</Alert>
      )}
    </Card>
  );
}

const openBankPage = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

/**
 * Fund-by-charge (ZAR/UGX): enter an amount, get a one-off account to pay into
 * (bank_transfer) or a redirect to authorise at the bank (eft).
 */
export function ChargeFundingCard({ currency }: { currency: string }) {
  const [amount, setAmount] = useState("");
  const [charge, setCharge] = useState<FundingCharge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = useCopy();
  // One reference per funding action: a retry of the same amount reuses it, so
  // the server returns the charge it already started instead of a second one.
  const fundingReference = useActionReference("fund");

  const submit = async () => {
    const value = Number(amount);
    if (!(value > 0)) {
      setError("Enter an amount to fund");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await initiateFundingCharge(value, fundingReference.referenceFor(`${currency}:${value}`));
      fundingReference.settle();
      setCharge(result);
      if (result.type === "eft" && result.redirectUrl) openBankPage(result.redirectUrl);
    } catch (e) {
      setError(friendlyErrorMessage(e, "Could not start funding"));
    } finally {
      setBusy(false);
    }
  };

  if (charge && charge.type === "bank_transfer" && charge.accountNumber) {
    return (
      <Card className="flex flex-col gap-4">
        <Eyebrow>Transfer {currency} to this account</Eyebrow>
        <AccountBlock bank={charge.bankName} number={charge.accountNumber} name={charge.accountName} />
        <Button variant="secondary" onClick={() => void copy(charge.accountNumber ?? "")}>
          Copy account number
        </Button>
        {charge.narration ? (
          <p className="text-sm text-muted">Use “{charge.narration}” as the transfer narration/reference.</p>
        ) : null}
        <p className="text-sm text-muted">
          This account is for a one-off transfer of the amount you entered. Your balance updates automatically once it arrives.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setCharge(null);
            setAmount("");
          }}
        >
          Fund a different amount
        </Button>
      </Card>
    );
  }

  if (charge && charge.type === "eft") {
    return (
      <Card className="flex flex-col gap-4">
        <Eyebrow>Authorise your bank transfer</Eyebrow>
        <p className="text-sm text-muted">
          We opened your bank’s secure page to approve this payment. Your balance updates once it’s confirmed.
        </p>
        {charge.redirectUrl ? (
          <Button variant="secondary" onClick={() => openBankPage(charge.redirectUrl ?? "")}>
            Open bank page again
          </Button>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Eyebrow>Fund with {currencyName(currency)}</Eyebrow>
        <Input
          aria-label={`Amount in ${currency}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder={`Amount in ${currency}`}
          error={error}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Starting…" : "Continue"}
        </Button>
        <p className="text-sm text-muted">Enter how much you want to add. We’ll show you where to pay.</p>
      </form>
    </Card>
  );
}

/** On-chain deposit address for a stablecoin, on a network that is open. */
export function CryptoDepositCard({ asset }: { asset: string }) {
  const [picked, setPicked] = useState<string>("tron");
  const copy = useCopy();
  // Which networks accept deposits right now (admin-controlled), not a static list.
  const { data: depositNetworks } = useDepositNetworks();
  const networkOptions = toNetworkOptions(depositNetworks);
  const network =
    networkOptions.length === 0 || networkOptions.some((o) => o.value === picked) ? picked : networkOptions[0].value;
  const { data: addresses } = useDepositAddresses();
  const address = addresses?.find((a) => a.network === network)?.address;

  return (
    <Card className="flex flex-col gap-4">
      <Eyebrow>Your {asset} deposit address</Eyebrow>
      <NetworkPicker options={networkOptions} value={network} onChange={setPicked} />
      {address ? (
        <>
          <AddressQr value={address} />
          <p className="select-all break-all text-center font-mono text-sm">{address}</p>
          <Button variant="secondary" onClick={() => void copy(address)}>
            Copy address
          </Button>
          <Alert tone="warning">
            Send only {asset} on {networkLabel(network)}. Sending any other asset or wrong network will result in permanent loss.
          </Alert>
        </>
      ) : (
        <p className="text-sm text-muted">Generating your {networkLabel(network)} address…</p>
      )}
    </Card>
  );
}
