"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { CurrencyPicker } from "@/components/common/CurrencyPicker";
import { NoHiddenFees } from "@/components/common/NoHiddenFees";
import { NetworkPicker, Segmented } from "@/components/convert/Chips";
import { assetForFiat, calcBuy, calcSell, quoteFees, sellExchangeFeeAsset, sellExchangeFeeFiat } from "@/lib/conversion";
import { isChargedFee, NO_HIDDEN_FEES_SHORT } from "@/lib/fees";
import { toQuoteParameters, useRate } from "@/lib/rates";
import { featureState, useFeatures } from "@/lib/features";
import { creditedAmount, executeBuy, executeSell, lockBuyQuote, lockSellQuote } from "@/lib/ramp";
import { friendlyErrorMessage } from "@/lib/api";
import { BALANCES_KEY, balanceOf, useBalances } from "@/lib/wallet";
import { formatMoney, currencyName, isStablecoin } from "@/lib/currency";
import { useCurrencyCatalogue } from "@/lib/currencies";
import { useFiatForCountry } from "@/lib/countries";
import { toNetworkOptions, useDepositNetworks } from "@/lib/depositNetworks";
import { useAuth } from "@/state/auth";
import type { BlockchainNetwork, Quote } from "@/types/api";

const countdown = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

type Mode = "buy" | "sell";
type Notice = { tone: "danger" | "success"; title: string; body: string };

export default function ConvertPage() {
  const { user } = useAuth();
  // The direction the user chose, if any. Until they choose, land on one that
  // works: opening on a stopped tab makes the whole screen look broken.
  const [chosenMode, setMode] = useState<Mode | null>(null);
  const { data: features } = useFeatures();
  const buyState = featureState(features, "onramp");
  const sellState = featureState(features, "offramp");
  const mode: Mode = chosenMode ?? (!buyState.enabled && sellState.enabled ? "sell" : "buy");
  const activeState = mode === "buy" ? buyState : sellState;
  const modeStopped = !activeState.enabled;
  const [input, setInput] = useState("");
  const catalogue = useCurrencyCatalogue();
  const stablecoins = useMemo(() => catalogue.filter((c) => c.kind === "stablecoin"), [catalogue]);
  const [picked, setPicked] = useState<string | null>(null);
  const asset = picked && stablecoins.some((c) => c.code === picked) ? picked : (stablecoins[0]?.code ?? "");
  // Sell only: when true the input is the fiat the user wants to RECEIVE.
  const [sellByFiat, setSellByFiat] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // The network the gas-fee component of the quote is priced against.
  const [pickedNetwork, setNetwork] = useState<BlockchainNetwork>("tron");
  const { data: depositNetworks } = useDepositNetworks();
  const networkOptions = toNetworkOptions(depositNetworks);
  const network: BlockchainNetwork =
    networkOptions.length === 0 || networkOptions.some((o) => o.value === pickedNetwork)
      ? pickedNetwork
      : (networkOptions[0].value as BlockchainNetwork);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!quote) return;
    const timer = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(timer);
  }, [quote]);

  const quoteExpired = secondsLeft <= 0;

  const { data: rate, isLoading, isError, refetch } = useRate(network, asset);
  const { data: balances } = useBalances();
  const assetBalance = balanceOf(balances, asset);

  const countryFiat = useFiatForCountry(user?.country);
  const fiatCurrency: string | null =
    rate?.fiatCurrency ?? countryFiat ?? balances?.find((b) => !isStablecoin(b.currency))?.currency ?? null;
  const fiatLabel = fiatCurrency ?? "local currency";

  const params = useMemo(() => (rate ? toQuoteParameters(rate, mode) : null), [rate, mode]);

  const numeric = Number(input.replace(/[^0-9.]/g, ""));
  const output = useMemo(() => {
    if (!params || !Number.isFinite(numeric) || numeric <= 0) return 0;
    if (mode === "buy") return calcBuy(numeric, params);
    return sellByFiat ? assetForFiat(numeric, params) : calcSell(numeric, params);
  }, [mode, numeric, params, sellByFiat]);

  const sellAssetAmount = sellByFiat ? output : numeric;
  const outputIsAsset = mode === "buy" || sellByFiat;

  const shownRate = params ? params.rate : null;
  const previewExchangeFeeAsset = params && mode === "sell" ? sellExchangeFeeAsset(params) : 0;
  const previewExchangeFeeLabel =
    params && previewExchangeFeeAsset > 0
      ? `${formatCoin(previewExchangeFeeAsset, asset)}${
          fiatCurrency ? ` (${formatMoney(sellExchangeFeeFiat(params), fiatCurrency)})` : ""
        }`
      : null;
  const rateLabel =
    shownRate !== null && fiatCurrency ? `${formatMoney(shownRate, fiatCurrency)}/${asset}` : isLoading ? "Loading…" : "—";

  const sourceLabel =
    mode === "buy" ? `You pay (${fiatLabel})` : sellByFiat ? `You want to receive (${fiatLabel})` : `You sell (${asset})`;
  const targetLabel = mode === "buy" ? `You get (${asset})` : sellByFiat ? `${asset} to sell` : `You receive (${fiatLabel})`;

  const onReview = async () => {
    if (!params || !fiatCurrency) return;
    const sellAmount = sellAssetAmount;
    if (mode === "buy" ? !numeric : !(sellAmount > 0)) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const base = { asset, network, fiatCurrency };
      const locked =
        mode === "buy" ? await lockBuyQuote({ ...base, amount: numeric }) : await lockSellQuote({ ...base, amount: sellAmount });
      setQuote(locked);
      setSecondsLeft(locked.expiresIn);
    } catch (err) {
      setNotice({ tone: "danger", title: "Could not lock a rate", body: friendlyErrorMessage(err, "Please try again.") });
    } finally {
      setSubmitting(false);
    }
  };

  const onConfirmBuy = async () => {
    if (!quote || quoteExpired || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await executeBuy(quote.id);
      await queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
      setQuote(null);
      setInput("");
      setNotice({
        tone: "success",
        title: "Purchase complete",
        body: `${creditedAmount(result).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${
          result.asset ?? asset
        } was added to your balance.`,
      });
    } catch (err) {
      setSecondsLeft(0);
      setNotice({ tone: "danger", title: "Buy failed", body: friendlyErrorMessage(err, "Something went wrong.") });
    } finally {
      setSubmitting(false);
    }
  };

  const onConfirmSell = async () => {
    if (!quote || quoteExpired || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await executeSell(quote.id);
      await queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
      setQuote(null);
      setInput("");
      setNotice({
        tone: "success",
        title: "Sale complete",
        body: `${formatMoney(result.fiatCredited, result.fiatCurrency)} was added to your ${currencyName(result.fiatCurrency)} balance.`,
      });
    } catch (err) {
      setSecondsLeft(0);
      setNotice({ tone: "danger", title: "Sell failed", body: friendlyErrorMessage(err, "Something went wrong.") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Convert</p>
      <PageHeader title="Convert your assets" subtitle={NO_HIDDEN_FEES_SHORT} />

      <div className="mb-5">
        <Segmented
          label="Direction"
          value={mode}
          onChange={(m) => {
            setMode(m);
            if (m === "buy") setSellByFiat(false);
            setInput("");
            setQuote(null);
            setNotice(null);
          }}
          options={[
            { value: "buy", label: buyState.enabled ? "Buy" : "Buy — soon" },
            { value: "sell", label: sellState.enabled ? "Sell" : "Sell — soon" },
          ]}
        />
      </div>

      {notice && (
        <div className="mb-4">
          <Alert tone={notice.tone}>
            <p className="font-semibold">{notice.title}</p>
            <p>{notice.body}</p>
          </Alert>
        </div>
      )}

      {modeStopped && (
        <Card>
          <p className="py-2 text-center text-muted">
            {activeState.message?.trim() ||
              (activeState.status === "COMING_SOON"
                ? "This is not available yet. We will let you know when it is."
                : "This is temporarily unavailable. Please try again later.")}
          </p>
        </Card>
      )}

      {!modeStopped && !quote && (
        <Card className="flex flex-col gap-5">
          <CurrencyPicker
            label="Asset"
            options={stablecoins}
            value={asset}
            onChange={(code) => {
              setPicked(code);
              setInput("");
              setQuote(null);
            }}
          />
          {mode === "sell" && (
            <Segmented
              size="sm"
              label="Amount unit"
              value={sellByFiat ? "fiat" : "coin"}
              onChange={(v) => {
                setSellByFiat(v === "fiat");
                setInput("");
              }}
              options={[
                { value: "coin", label: `Enter ${asset}` },
                { value: "fiat", label: `Enter ${fiatLabel}` },
              ]}
            />
          )}
          <div className="flex flex-col gap-1.5">
            <Input label={sourceLabel} placeholder="0" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} />
            {mode === "sell" && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted tabular">
                  Balance: {assetBalance.toLocaleString("en-US", { maximumFractionDigits: 6 })} {asset}
                </span>
                {!sellByFiat && (
                  <button
                    type="button"
                    onClick={() => setInput(String(assetBalance))}
                    disabled={assetBalance <= 0}
                    className="font-bold text-primary disabled:text-subtle"
                  >
                    Max
                  </button>
                )}
              </div>
            )}
          </div>
          {mode === "sell" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Network</p>
              <NetworkPicker options={networkOptions} value={network} onChange={(v) => setNetwork(v as BlockchainNetwork)} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted">{targetLabel}</p>
            <p className="font-display text-3xl font-bold text-primary tabular break-all">
              {outputIsAsset
                ? `${output.toLocaleString(undefined, { maximumFractionDigits: 6 })}${sellByFiat ? ` ${asset}` : ""}`
                : fiatCurrency
                  ? formatMoney(output, fiatCurrency)
                  : "—"}
            </p>
          </div>
          <div className="flex justify-between gap-4">
            <SummaryItem label="Rate" value={rateLabel} />
            {previewExchangeFeeLabel && <SummaryItem label="Exchange fee" value={previewExchangeFeeLabel} alignEnd />}
          </div>
          <Button
            block
            onClick={() => void onReview()}
            loading={submitting}
            disabled={!params || submitting || (mode === "sell" ? !(sellAssetAmount > 0) : !numeric)}
          >
            {mode === "buy" ? "Review buy" : "Review sell"}
          </Button>
        </Card>
      )}

      {quote && (
        <Card className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">{mode === "buy" ? "Review your purchase" : "Review your sale"}</h2>
          <dl className="flex flex-col gap-3">
            {reviewRows(quote, mode).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="text-right font-semibold tabular">{value}</dd>
              </div>
            ))}
          </dl>
          <NoHiddenFees />
          {quoteExpired ? (
            <p className="text-center text-sm text-danger">Quote expired — rates move, so grab a fresh one.</p>
          ) : (
            <p className="text-center text-sm text-primary tabular">Locked rate expires in {countdown(secondsLeft)}</p>
          )}
          {quoteExpired ? (
            <Button block onClick={() => void onReview()} loading={submitting}>
              Get a new quote
            </Button>
          ) : (
            <Button
              block
              onClick={() => void (mode === "buy" ? onConfirmBuy() : onConfirmSell())}
              loading={submitting}
              disabled={submitting}
            >
              {mode === "buy" ? "Confirm purchase" : "Confirm sale"}
            </Button>
          )}
          <Button block variant="ghost" onClick={() => setQuote(null)}>
            Edit amount
          </Button>
        </Card>
      )}

      {isError ? (
        <button type="button" onClick={() => void refetch()} className="mt-5 block w-full text-center text-sm text-danger">
          Couldn&apos;t load the current rate. Tap to retry.
        </button>
      ) : (
        <p className="mt-5 text-center text-sm text-subtle">
          Rate refreshes every 15s. The final rate and every fee, including any ZemFi fee, are locked and shown on the next step
          before you confirm.
        </p>
      )}
    </div>
  );
}

// Which leg of a quote is the coin and which is the fiat.
const coinOf = (quote: Quote): string => (isStablecoin(quote.sourceCurrency) ? quote.sourceCurrency : quote.destinationCurrency);
const fiatOf = (quote: Quote): string => (isStablecoin(quote.sourceCurrency) ? quote.destinationCurrency : quote.sourceCurrency);

const formatCoin = (value: number, code: string): string =>
  `${value.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${code}`;

/**
 * The review lines for a locked quote, all from the server's numbers:
 *   sell: You receive = You sell x Rate - Exchange fee - ZemFi fee
 *   buy:  You get     = (You pay - ZemFi fee) / Rate
 */
const reviewRows = (quote: Quote, mode: Mode): (readonly [label: string, value: string])[] => {
  const fiat = fiatOf(quote);
  const coin = coinOf(quote);
  const fees = quoteFees(quote);
  const rows: (readonly [string, string])[] = [];
  if (mode === "buy") rows.push(["You pay", formatMoney(quote.sourceAmount, quote.sourceCurrency)]);
  else rows.push(["You sell", formatCoin(quote.sourceAmount, quote.sourceCurrency)]);
  rows.push(["Rate", `${formatMoney(quote.rate, fiat)}/${coin}`]);
  if (isChargedFee(fees.exchangeFeeFiat)) {
    rows.push([
      "Exchange fee",
      fees.exchangeFeeAsset > 0
        ? `${formatCoin(fees.exchangeFeeAsset, coin)} (${formatMoney(fees.exchangeFeeFiat, fiat)})`
        : formatMoney(fees.exchangeFeeFiat, fiat),
    ]);
  }
  if (isChargedFee(fees.zemfiFee)) rows.push(["ZemFi fee", formatMoney(fees.zemfiFee, fiat)]);
  if (mode === "buy") rows.push(["You get", formatCoin(quote.destinationAmount, quote.destinationCurrency)]);
  else rows.push(["You receive", formatMoney(quote.destinationAmount, quote.destinationCurrency)]);
  return rows;
};

function SummaryItem({ label, value, alignEnd }: { label: string; value: string; alignEnd?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${alignEnd ? "items-end text-right" : ""}`}>
      <span className="text-xs text-subtle">{label}</span>
      <span className="text-sm tabular">{value}</span>
    </div>
  );
}
