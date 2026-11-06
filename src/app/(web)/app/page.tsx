"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFeatures, featureState } from "@/lib/features";
import { useAuth } from "@/state/auth";
import { useBalances } from "@/lib/wallet";
import { totalIn } from "@/lib/portfolio";
import { useRate } from "@/lib/rates";
import { assetName } from "@/lib/assetMeta";
import { formatMoney, isStablecoin, metaOrCode } from "@/lib/currency";
import { useCurrencyCatalogue } from "@/lib/currencies";
import {
  getStoredBalanceCurrency,
  getStoredBalanceHidden,
  setStoredBalanceCurrency,
  setStoredBalanceHidden,
} from "@/lib/balancePrefs";
import { CurrencyPicker } from "@/components/common/CurrencyPicker";
import { AssetIcon } from "@/components/common/AssetIcon";
import { ListGroup, ListRow, SectionHeader } from "@/components/common/ListRow";
import { ActionTile, FeatureAction, ICONS } from "@/components/dashboard/QuickActions";
import { VerificationJourneyCard } from "@/components/dashboard/VerificationJourneyCard";
import { InternationalCard } from "@/components/dashboard/InternationalCard";
import { RateStrip } from "@/components/dashboard/RateStrip";

const eye = (hidden: boolean) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
    {hidden && <path d="M3 3l18 18" />}
  </svg>
);

export default function DashboardPage() {
  const { data: features } = useFeatures();
  const { user } = useAuth();
  const { data: balances } = useBalances();
  // The local fiat is whatever non-stablecoin balance the API surfaces. It
  // leads the currency options and is the default view until another is picked.
  const fiat = balances?.find((b) => !isStablecoin(b.currency));
  const fiatCurrency = fiat?.currency ?? "";
  // The user's own fiat, then every stablecoin the backend catalogues.
  const catalogue = useCurrencyCatalogue();
  const currencyOptions = useMemo(() => {
    const own = fiatCurrency ? (catalogue.find((c) => c.code === fiatCurrency) ?? metaOrCode(fiatCurrency)) : null;
    return [...(own ? [own] : []), ...catalogue.filter((c) => c.code !== fiatCurrency && c.kind === "stablecoin")];
  }, [fiatCurrency, catalogue]);
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(getStoredBalanceCurrency);
  const balanceCurrency =
    chosenCurrency && currencyOptions.some((o) => o.code === chosenCurrency)
      ? chosenCurrency
      : ((fiatCurrency || currencyOptions[0]?.code) ?? "");
  // Everything held, valued in the chosen currency.
  const { data: rate } = useRate("tron");
  const total = totalIn(balanceCurrency, balances, rate);
  const balance = total.amount === null ? "—" : formatMoney(total.amount, balanceCurrency);
  const pickCurrency = (currency: string) => {
    setChosenCurrency(currency);
    void setStoredBalanceCurrency(currency);
  };
  // Masked for checking the app in public.
  const [balanceHidden, setBalanceHidden] = useState(getStoredBalanceHidden);
  const toggleBalanceHidden = () => {
    const next = !balanceHidden;
    setBalanceHidden(next);
    void setStoredBalanceHidden(next);
  };

  // Every balance held, own fiat first, then stablecoins, then tokens.
  const rank = (code: string) => (code === fiatCurrency ? 0 : isStablecoin(code) ? 1 : 2);
  const holdings = (balances ?? [])
    .filter((b) => b.balance > 0 || b.currency === fiatCurrency)
    .sort((a, b) => rank(a.currency) - rank(b.currency));
  const tokensLive = featureState(features, "tokens").status === "LIVE";

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Hi {user?.firstName ?? "there"}</h1>

      {/* The balance leads, unboxed: the one number the app exists to show. */}
      <section className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted">Total balance</p>
            <button
              type="button"
              onClick={toggleBalanceHidden}
              aria-label={balanceHidden ? "Show balance" : "Hide balance"}
              className="-m-2 p-2 text-muted hover:text-foreground"
            >
              {eye(balanceHidden)}
            </button>
          </div>
          <p className="mt-1 truncate font-display text-4xl font-bold tracking-tight tabular sm:text-5xl">
            {balanceHidden ? "••••••" : balance}
          </p>
          {!balanceHidden && total.amount !== null && total.unpriced.length > 0 && (
            <p className="mt-1 text-sm text-subtle">Excluding {total.unpriced.join(", ")}: no rate available</p>
          )}
          {!balanceHidden && total.amount === null && (
            <p className="mt-1 text-sm text-subtle">We could not price your balance just now.</p>
          )}
        </div>
        {currencyOptions.length > 1 && (
          <div className="sm:w-56">
            <CurrencyPicker options={currencyOptions} value={balanceCurrency} onChange={pickCurrency} />
          </div>
        )}
      </section>

      <nav aria-label="Quick actions" className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5">
        <FeatureAction features={features} featureKey={["global_send", "crypto_send"]} label="Send" href="/app/send" icon={ICONS.send} />
        <FeatureAction features={features} featureKey={["receiving", "funding"]} label="Receive" href="/app/receive" icon={ICONS.receive} />
        {/* The converter is both directions: gone only when BOTH are off. */}
        <FeatureAction features={features} featureKey={["onramp", "offramp"]} label="Convert" href="/app/convert" icon={ICONS.convert} />
        <FeatureAction features={features} featureKey="tokens" label="Tokens" href="/app/tokens" icon={ICONS.tokens} />
        {/* Not live yet: the page it opens says so. */}
        <ActionTile href="/app/bills" label="Bills" icon={ICONS.bills} />
      </nav>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <aside className="flex flex-col gap-6 lg:order-last">
          <VerificationJourneyCard />
          {/* Prices the stablecoin the balance is shown in; with the user's own
              fiat selected, the default coin. */}
          <RateStrip asset={isStablecoin(balanceCurrency) ? balanceCurrency : undefined} />
          <InternationalCard />
        </aside>

        <div className="min-w-0">
          {holdings.length > 0 && (
            <>
              <div className="[&>div]:mt-0">
                <SectionHeader
                  title="Assets"
                  action={
                    tokensLive ? (
                      <Link href="/app/tokens" className="text-sm font-medium text-primary hover:underline">
                        Tokens
                      </Link>
                    ) : undefined
                  }
                />
              </div>
              <ListGroup>
                {holdings.map((h) => {
                  const token = !isStablecoin(h.currency) && h.currency !== fiatCurrency;
                  return (
                    <ListRow
                      key={h.currency}
                      left={<AssetIcon code={h.currency} />}
                      title={assetName(h.currency)}
                      subtitle={h.currency}
                      value={balanceHidden ? "••••" : formatMoney(h.balance, h.currency)}
                      href={token && tokensLive ? "/app/tokens" : undefined}
                    />
                  );
                })}
              </ListGroup>
            </>
          )}

          <SectionHeader title="More" />
          <ListGroup>
            <ListRow
              left={
                <span className="flex size-10 items-center justify-center rounded-full bg-wash text-primary">{ICONS.bank}</span>
              }
              title="Bank accounts"
              subtitle="Where your withdrawals go"
              href="/app/bank-accounts"
            />
          </ListGroup>
        </div>
      </div>
    </div>
  );
}
