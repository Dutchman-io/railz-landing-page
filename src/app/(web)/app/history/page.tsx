"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTransactions, type LedgerActivity } from "@/lib/wallet";
import { activityLabel, formatAmount, formatCounter, formatWhen, isCredit, statusLabel } from "@/lib/activity";
import { featureState, useFeatures } from "@/lib/features";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Loading, Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { friendlyErrorMessage } from "@/lib/api";
import { stashTransaction } from "@/components/history/txStash";

const statusClass = (status: LedgerActivity["status"]) =>
  status === "COMPLETED" || status === "CONFIRMED" ? "text-primary" : status === "FAILED" ? "text-danger" : "text-warning";

function Row({ tx }: { tx: LedgerActivity }) {
  const counter = formatCounter(tx);
  return (
    <Link
      href={`/app/transaction/${encodeURIComponent(tx.id)}`}
      onClick={() => stashTransaction(tx)}
      className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-wash sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{activityLabel(tx)}</p>
        <p className="text-sm text-muted">{formatWhen(tx.createdAt)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`font-semibold tabular ${isCredit(tx) ? "text-primary" : ""}`}>{formatAmount(tx)}</p>
        {counter && <p className="font-semibold tabular text-primary">{counter}</p>}
        <p className={`text-[0.65rem] font-bold uppercase tracking-wider ${statusClass(tx.status)}`}>{statusLabel(tx.status)}</p>
      </div>
    </Link>
  );
}

export default function HistoryPage() {
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useTransactions();
  const { data: features } = useFeatures();
  // Receive covers both adding your own money and being paid from abroad, so
  // the way in only disappears when BOTH rails are off.
  const moneyInStopped =
    featureState(features, "funding").status === "OFF" && featureState(features, "receiving").status === "OFF";

  const items = data?.pages.flatMap((p) => p.transactions) ?? [];

  // Infinite scroll: load the next page as the end of the list comes into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest text-primary">ACTIVITY</p>
      <PageHeader title="Transaction history" />

      {isLoading ? (
        <Loading />
      ) : isError && items.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{friendlyErrorMessage(error, "Could not load your transactions.")}</Alert>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">No transactions yet</h2>
          <p className="text-muted">
            Add money to get started — deposits, sales and payouts show up here as soon as they&apos;re confirmed.
          </p>
          {!moneyInStopped && <ButtonLink href="/app/receive">Receive money</ButtonLink>}
        </Card>
      ) : (
        <>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {items.map((tx) => (
              <Row key={tx.id} tx={tx} />
            ))}
          </div>
          <div ref={sentinel} />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4 text-primary">
              <Spinner />
            </div>
          )}
        </>
      )}
    </div>
  );
}
