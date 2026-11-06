"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { CurrencyPicker } from "@/components/common/CurrencyPicker";
import { ChargeFundingCard, CryptoDepositCard, VirtualAccountCard } from "@/components/receive/ArrivalCards";
import {
  activityLabel,
  depositFields,
  openReceivingAccount,
  refreshReceivingAccount,
  shareableSummary,
  useReceivingAccounts,
  useReceivingActivity,
  useReceivingCurrencies,
  RECEIVING_ACCOUNTS_KEY,
  RECEIVING_ACTIVITY_KEY,
} from "@/lib/receiving";
import { useBalances } from "@/lib/wallet";
import { currencyMeta, isStablecoin } from "@/lib/currency";
import { useCurrencyCatalogue } from "@/lib/currencies";
import { featureState, useFeatures } from "@/lib/features";
import { apiErrorCode, friendlyErrorMessage } from "@/lib/api";

/**
 * Where international verification enrols the user for a receiving currency:
 * the partner that opens the account serves these countries.
 */
const ENROL_COUNTRY_FOR_CURRENCY: Record<string, string> = {
  USD: "US",
  EUR: "DE",
  GBP: "GB",
};

/** An open-account refusal, shown as the dialog the mobile app raises. */
type OpenProblem = { title: string; message: string; enrolCountry?: string };

export default function ReceivePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    data: currencies = [],
    isLoading: loadingCurrencies,
    isError: currenciesFailed,
    refetch: refetchCurrencies,
  } = useReceivingCurrencies();
  const { data: accounts = [], isLoading } = useReceivingAccounts();
  const { data: activity = [] } = useReceivingActivity();

  const [selected, setSelected] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [problem, setProblem] = useState<OpenProblem | null>(null);
  const { data: balances } = useBalances();
  const { data: features } = useFeatures();

  // The user's own fiat, whatever non-stablecoin balance the API surfaces.
  const localFiat = balances?.find((b) => !isStablecoin(b.currency))?.currency ?? null;

  // Their own currency first, then whoever pays them from abroad, then on-chain.
  const catalogue = useCurrencyCatalogue();
  const options = useMemo(() => {
    const onchain = catalogue.filter((c) => c.arrival === "onchain");
    const foreign = catalogue.filter((c) => c.arrival === "receiving" || currencies.includes(c.code));
    const mine = catalogue.filter((c) => c.code === localFiat);
    const seen = new Set<string>();
    return [...mine, ...foreign, ...onchain].filter((c) => (seen.has(c.code) ? false : (seen.add(c.code), true)));
  }, [localFiat, currencies, catalogue]);

  const funding = featureState(features, "funding");
  const fundingBlocked = funding.status !== "LIVE";

  const currency = selected ?? localFiat ?? accounts[0]?.currency ?? options[0]?.code ?? null;

  const meta = currency ? currencyMeta(currency) : undefined;
  const isCrypto = meta?.arrival === "onchain";
  const isLocalFiat = !!currency && currency === localFiat;
  const account = useMemo(() => accounts.find((a) => a.currency === currency) ?? null, [accounts, currency]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: RECEIVING_ACCOUNTS_KEY }),
      queryClient.invalidateQueries({ queryKey: RECEIVING_ACTIVITY_KEY }),
    ]);
  };

  const onOpen = async () => {
    if (!currency || opening) return;
    setOpening(currency);
    try {
      await openReceivingAccount(currency);
      await invalidate();
    } catch (err) {
      const message = friendlyErrorMessage(err, "Something went wrong. Please try again.");
      const code = apiErrorCode(err);
      if (code === "INTERNATIONAL_VERIFICATION_REQUIRED") {
        // Not a KYC tier: the partner abroad has to onboard the user first.
        setProblem({
          title: "Unlock international transfers",
          message,
          enrolCountry: ENROL_COUNTRY_FOR_CURRENCY[currency.toUpperCase()] ?? "US",
        });
      } else if (code === "INTERNATIONAL_VERIFICATION_PENDING") {
        setProblem({ title: "International verification in review", message });
      } else {
        setProblem({ title: `Could not open a ${currency} account`, message });
      }
    } finally {
      setOpening(null);
    }
  };

  const onRefreshAccount = async () => {
    if (!currency || !account) return;
    try {
      await refreshReceivingAccount(currency);
      await invalidate();
    } catch {
      // A failed status refresh changes nothing the user can act on.
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied to your clipboard.`);
    } catch {
      toast("Could not copy. Select the text and copy it instead.", "danger");
    }
  };

  const share = async () => {
    if (!account) return;
    const text = shareableSummary(account);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    await copy(text, "Account details");
  };

  const fields = account ? depositFields(account.depositInstructions) : [];
  const rails = account?.depositInstructions.payment_rails ?? [];

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Receive money"
        subtitle="Every way money reaches your wallet. Pick a currency and we will show you where it lands — your own account, one for whoever is paying you from abroad, or an on-chain address."
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CurrencyPicker label="Currency" options={options} value={currency} onChange={setSelected} />
        </Card>

        {isCrypto && currency ? (
          <CryptoDepositCard asset={currency} />
        ) : isLocalFiat && currency ? (
          fundingBlocked ? (
            <Card className="flex flex-col gap-2">
              <p className="font-semibold">
                {funding.status === "COMING_SOON" ? `Adding ${currency} is not available yet` : `Adding ${currency} is paused`}
              </p>
              <p className="text-sm text-muted">
                {funding.message?.trim() ||
                  (funding.status === "COMING_SOON"
                    ? "We will let you know when it is ready."
                    : "This is temporarily unavailable. Please try again later.")}
              </p>
            </Card>
          ) : meta?.arrival === "virtual_account" ? (
            <VirtualAccountCard currency={currency} />
          ) : (
            <ChargeFundingCard currency={currency} />
          )
        ) : !currency ? (
          <Card className="flex flex-col gap-3">
            {loadingCurrencies ? (
              <p className="text-sm text-muted">Loading the currencies we support…</p>
            ) : (
              <>
                <p className="font-semibold">
                  {currenciesFailed ? "Could not load receiving currencies" : "Receiving is not available yet"}
                </p>
                <p className="text-sm text-muted">
                  {currenciesFailed
                    ? "We could not reach the server. Check your connection and try again."
                    : "Being paid from abroad is not switched on for your account yet."}
                </p>
                {currenciesFailed && (
                  <Button variant="secondary" onClick={() => void refetchCurrencies()}>
                    Try again
                  </Button>
                )}
              </>
            )}
          </Card>
        ) : account ? (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Your {currency} account details</p>
              <StatusPill status={account.status} />
            </div>
            <p className="-mt-2 text-sm text-muted">Share these with whoever is paying you.</p>

            <div className="divide-y divide-border rounded-xl border border-border">
              {fields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => void copy(f.value, f.label)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-wash"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted">{f.label}</span>
                    <span className="block break-all font-medium tabular">{f.value}</span>
                  </span>
                  <span className="text-sm font-semibold text-primary">Copy</span>
                </button>
              ))}
            </div>

            {rails.length > 0 && <p className="text-sm text-muted">Accepts {rails.join(", ").replace(/_/g, " ")}</p>}

            <Button variant="secondary" onClick={() => void share()}>
              Share details
            </Button>

            <p className="text-sm text-subtle">
              Paid in as {account.settlement.asset} on {account.settlement.network}, into your wallet.
            </p>

            {account.status !== "activated" && (
              <button type="button" onClick={() => void onRefreshAccount()} className="w-fit text-sm font-semibold text-primary">
                Check status
              </button>
            )}
          </Card>
        ) : (
          <Card className="flex flex-col items-center gap-3 text-center">
            <span className="text-4xl" aria-hidden="true">
              🏦
            </span>
            <p className="font-display text-xl font-semibold">Get paid in {currency}</p>
            <p className="text-muted">
              We will open a {currency} account in your name. Share its details with anyone paying you, and what arrives is
              converted and added to your wallet.
            </p>
            <Button block loading={opening === currency} disabled={!!opening || isLoading} onClick={() => void onOpen()}>
              Open my {currency} account
            </Button>
            <p className="text-sm text-subtle">Takes a moment, and only happens once per currency.</p>
          </Card>
        )}

        {/* Payments — including ones still on their way, which no balance shows */}
        {activity.length > 0 && (
          <Card className="flex flex-col gap-3">
            <p className="font-semibold">Recent payments</p>
            <div className="divide-y divide-border">
              {activity.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.senderName ?? a.description ?? "Payment"}</p>
                    <p className="text-sm text-muted">
                      {activityLabel(a.type)} · {new Date(a.occurredAt).toLocaleDateString()}
                    </p>
                  </div>
                  {a.amount !== null && (
                    <p className="shrink-0 font-semibold tabular">
                      {a.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                      {a.currency ?? ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={!!problem}
        onClose={() => setProblem(null)}
        title={problem?.title}
        footer={
          problem?.enrolCountry ? (
            <>
              <ButtonLink href={`/app/kyc-tier3?destinationCountry=${problem.enrolCountry}`}>
                Unlock international transfers
              </ButtonLink>
              <Button variant="ghost" onClick={() => setProblem(null)}>
                Not now
              </Button>
            </>
          ) : (
            <Button onClick={() => setProblem(null)}>OK</Button>
          )
        }
      >
        <p className="text-muted">{problem?.message}</p>
      </Modal>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "activated";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
      }`}
    >
      {active ? "Ready" : "Pending"}
    </span>
  );
}
