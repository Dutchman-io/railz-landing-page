"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTransactions, type LedgerActivity } from "@/lib/wallet";
import { activityLabel, formatAmount, formatCounter, formatWhen, isCredit, isSwap, statusLabel } from "@/lib/activity";
import { timelineFor } from "@/lib/timeline";
import { formatMoney, isStablecoin } from "@/lib/currency";
import { networkLabel } from "@/lib/networks";
import { explorerTxUrl } from "@/lib/explorer";
import { paymentPurposeLabel } from "@/lib/globalSend";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, buttonClass } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { Timeline } from "@/components/history/Timeline";
import { readStashedTransaction } from "@/components/history/txStash";

const shorten = (value: string): string => (value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value);

// Context rows derived from the entry metadata, per transaction kind.
const detailRows = (tx: LedgerActivity): [string, string][] => {
  const meta = tx.metadata ?? {};

  const rows: [string, string][] = [];
  if (isSwap(tx)) {
    rows.push(["Paid", formatMoney(tx.amount, tx.currency)]);
    rows.push(["Received", formatMoney(tx.counterAmount, tx.counterCurrency)]);
  }
  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  const num = (v: unknown): string | null => (typeof v === "number" ? String(v) : null);

  // Network and hash come from the top-level fields; metadata only ever
  // carried them for deposits, never for sends.
  const network = tx.network ?? str(meta.network);
  if (network) rows.push(["Network", networkLabel(network)]);
  const accountNumber = str(meta.accountNumber);
  if (accountNumber) rows.push(["Bank account", accountNumber]);
  // A cross-border send's reason for payment. An unknown code is left out.
  const purpose = paymentPurposeLabel(meta.purpose);
  if (purpose) {
    rows.push(["Reason", purpose]);
    const note = str(meta.purposeNote);
    if (note) rows.push(["Details", note]);
  }
  const rate = num(meta.rate);
  if (rate) {
    // The rate is fiat per coin; the fiat is whichever side of this entry is
    // not the stablecoin, and the coin is the other one.
    const entryIsCoin = isStablecoin(tx.currency);
    const fiat = entryIsCoin ? (str(meta.fiatCurrency) ?? str(meta.toCurrency) ?? str(meta.currency)) : tx.currency;
    const coin = entryIsCoin ? tx.currency : (str(meta.asset) ?? str(meta.fromCurrency) ?? "");
    const per = coin ? ` per ${coin}` : "";
    rows.push(["Rate", fiat ? `${formatMoney(Number(rate), fiat)}${per}` : `${Number(rate).toLocaleString()}${per}`]);
  }
  return rows;
};

/** On print, only the receipt is shown: the shell and the buttons are hidden. */
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #receipt, #receipt * { visibility: visible !important; }
  #receipt { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 24px; }
}`;

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const txId = decodeURIComponent(id ?? "");
  const { data, isLoading } = useTransactions();
  const [stashed] = useState(() => readStashedTransaction(txId));
  const tx = data?.pages.flatMap((p) => p.transactions).find((t) => t.id === txId) ?? stashed;
  const toast = useToast();
  const back = { href: "/app/history", label: "History" };

  if (!tx && isLoading) return <Loading />;
  if (!tx) {
    return (
      <div>
        <PageHeader title="Transaction" back={back} />
        <Card>
          <p className="text-muted">This transaction could not be loaded.</p>
        </Card>
      </div>
    );
  }

  const explorerUrl = explorerTxUrl(tx.network, tx.txHash);
  const steps = timelineFor(tx);
  const rows: [string, string][] = [
    ["Status", statusLabel(tx.status)],
    ["Date", formatWhen(tx.createdAt)],
    ...detailRows(tx),
    ["Reference", shorten(tx.reference)],
  ];
  const counter = formatCounter(tx);

  // A receipt for a landlord, an accountant, a group chat: the share sheet
  // where the browser has one, otherwise the details copied as text.
  const shareReceipt = async () => {
    const text = [
      `Receipt · ${activityLabel(tx)}`,
      formatAmount(tx),
      ...(counter ? [counter] : []),
      ...rows.map(([k, v]) => `${k}: ${k === "Reference" ? tx.reference : v}`),
    ].join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: `Receipt · ${activityLabel(tx)}`, text });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Receipt copied");
    } catch {
      toast("Could not prepare the receipt. Please try again.", "danger");
    }
  };

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(tx.txHash as string);
      toast("Copied");
    } catch {
      toast("Could not copy. Select the hash and copy it instead.", "danger");
    }
  };

  const reportHref = `mailto:support@zemfi.ng?subject=${encodeURIComponent(
    `Problem with ${formatAmount(tx)}`,
  )}&body=${encodeURIComponent(`Reference: ${tx.reference}\n\n`)}`;

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <PageHeader title="Transaction" back={back} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div id="receipt" className="flex min-w-0 flex-col gap-6">
          <Card className="flex flex-col items-center gap-1 text-center">
            <p className="text-muted">{activityLabel(tx)}</p>
            <p className={`font-display text-4xl font-bold tabular ${isCredit(tx) ? "text-primary" : ""}`}>{formatAmount(tx)}</p>
            {counter && <p className="font-display text-4xl font-bold tabular text-primary">{counter}</p>}
            {tx.status !== "COMPLETED" && tx.status !== "CONFIRMED" && (
              <p className={`text-sm ${tx.status === "FAILED" ? "text-danger" : "text-warning"}`}>{statusLabel(tx.status)}</p>
            )}
          </Card>

          {steps && (
            <Card className="flex flex-col gap-4">
              <p className="text-sm text-muted">Progress</p>
              <Timeline steps={steps} />
            </Card>
          )}

          <Card className="py-1 sm:py-1">
            <dl className="divide-y divide-border">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="text-right text-sm break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Button variant="secondary" onClick={() => void shareReceipt()}>
            Share receipt
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Print or save as PDF
          </Button>

          {tx.txHash && (
            <Card className="flex flex-col gap-3">
              <p className="text-sm text-muted">Transaction hash</p>
              {/* Full hash, wrapped rather than truncated: a partial hash can't
                  be pasted into an explorer. */}
              <p className="font-mono text-sm break-all select-all">{tx.txHash}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void copyHash()}>
                  Copy
                </Button>
                {explorerUrl && (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                    View on explorer
                  </a>
                )}
              </div>
            </Card>
          )}

          <a href={reportHref} className={buttonClass("ghost")}>
            Report a problem
          </a>
        </div>
      </div>
    </div>
  );
}
