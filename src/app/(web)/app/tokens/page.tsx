"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CodeInput, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Loading } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { AssetIcon } from "@/components/common/AssetIcon";
import { ListGroup, ListRow, SectionHeader } from "@/components/common/ListRow";
import { Pill, Segmented } from "@/components/convert/Chips";
import { AddressQr } from "@/components/receive/AddressQr";
import { assetName, networkName } from "@/lib/assetMeta";
import { apiErrorCode, friendlyErrorMessage } from "@/lib/api";
import { featureState, useFeatures } from "@/lib/features";
import { BALANCES_KEY, useBalances } from "@/lib/wallet";
import { formatMoney, isStablecoin } from "@/lib/currency";
import { useActionReference } from "@/lib/idempotency";
import { isTwoFactorRequired, twoFactorMessage, useTwoFactorStatus } from "@/lib/twoFactor";
import {
  CONVERSION_TOLERANCE,
  TOKENS_KEY,
  convertToken,
  quoteConversion,
  quoteTokenSend,
  sendToken,
  useTokenAddress,
  useTokenRate,
  useTokens,
  type TokenConversionQuote,
  type TokenHolding,
  type TokenSendQuote,
} from "@/lib/tokens";

type Tab = "receive" | "convert" | "send";

const TABS: { value: Tab; label: string }[] = [
  { value: "receive", label: "Receive" },
  { value: "convert", label: "Convert" },
  { value: "send", label: "Send" },
];

/** A token amount, to as many places as it has, without trailing zeros. */
const fmtToken = (n: number | string, places = 8): string => Number(n).toLocaleString("en-US", { maximumFractionDigits: places });

/** An amount in the conversion target: money for a fiat, digits for a coin. */
const fmtMoneyIn = (n: number, currency: string): string =>
  isStablecoin(currency) ? `${fmtToken(n, 6)} ${currency}` : formatMoney(n, currency);

/** A positive number the user typed, or null. */
const parseAmount = (raw: string): number | null => {
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Tokens the user holds in their own wallet (BTC, ETH, SOL, BNB, TRX):
 * receive them, convert them to USDT or their own currency, or send them
 * on-chain. Behind the `tokens` switch.
 */
export default function TokensPage() {
  const { data: features } = useFeatures();
  const state = featureState(features, "tokens");
  const live = state.status === "LIVE";
  const { data: tokens, isLoading, error, refetch } = useTokens(live);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("receive");
  const holding = selected ? (tokens?.find((t) => t.token === selected) ?? null) : null;
  const held = (tokens ?? []).filter((t) => t.balance > 0);
  const others = (tokens ?? []).filter((t) => t.balance <= 0);
  const open = (token: string) => {
    setSelected(token);
    setTab(tokens?.find((t) => t.token === token)?.balance ? "convert" : "receive");
  };

  if (!live) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Tokens" />
        <Card>
          <p>
            {state.message?.trim() ||
              "Holding BTC, ETH and other tokens is not available yet. We will let you know when it is."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      {!holding && (
        <PageHeader
          title="Tokens"
          subtitle="Hold tokens in your own wallet. Convert them to USDT or your own currency, or send them on."
        />
      )}

      {isLoading && <Loading />}
      {!isLoading && (tokens?.length ?? 0) === 0 && (
        <Card className="flex flex-col gap-4">
          <p>
            {error
              ? apiErrorCode(error) === "TOKEN_DEPOSITS_NOT_ENABLED"
                ? "Tokens are not switched on for your account yet. We will let you know when they are."
                : friendlyErrorMessage(error, "We could not load your tokens just now.")
              : "No tokens are available right now."}
          </p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </Card>
      )}

      {!holding && held.length > 0 && (
        <>
          <SectionHeader title="Your tokens" />
          <ListGroup>
            {held.map((t) => (
              <TokenRow key={t.token} holding={t} onClick={() => open(t.token)} />
            ))}
          </ListGroup>
        </>
      )}
      {!holding && others.length > 0 && (
        <>
          <SectionHeader title={held.length > 0 ? "More tokens" : "All tokens"} />
          <ListGroup>
            {others.map((t) => (
              <TokenRow key={t.token} holding={t} onClick={() => open(t.token)} />
            ))}
          </ListGroup>
        </>
      )}

      {holding && (
        <>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
            aria-label="Back to all tokens"
          >
            <span aria-hidden="true">←</span> All tokens
          </button>
          <div className="mb-5 flex items-center gap-4">
            <AssetIcon code={holding.token} size={56} />
            <div className="min-w-0">
              <p className="font-semibold">{assetName(holding.token)}</p>
              <p className="truncate font-display text-2xl font-bold tabular">
                {fmtToken(holding.balance)} {holding.token}
              </p>
              <p className="text-sm text-muted">On {networkName(holding.network)}</p>
            </div>
          </div>
          <div className="mb-4">
            <Segmented label="Token actions" options={TABS} value={tab} onChange={setTab} />
          </div>
          {tab === "receive" && <ReceivePanel holding={holding} />}
          {tab === "convert" && <ConvertPanel key={holding.token} holding={holding} />}
          {tab === "send" && <SendPanel key={holding.token} holding={holding} />}
        </>
      )}
    </div>
  );
}

/** One token in the list: its icon, name and network, and what is held. */
function TokenRow({ holding, onClick }: { holding: TokenHolding; onClick: () => void }) {
  return (
    <ListRow
      left={<AssetIcon code={holding.token} />}
      title={assetName(holding.token)}
      subtitle={`${holding.token} · ${networkName(holding.network)}`}
      value={holding.balance > 0 ? fmtToken(holding.balance) : undefined}
      subvalue={holding.balance > 0 ? holding.token : undefined}
      onClick={onClick}
    />
  );
}

function ReceivePanel({ holding }: { holding: TokenHolding }) {
  const toast = useToast();
  const { data, isLoading, error } = useTokenAddress(holding.token);
  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`Your ${holding.token} ${what} is on the clipboard.`);
    } catch {
      toast("Could not copy. Select the text and copy it instead.", "danger");
    }
  };
  // XRP needs a destination tag, XLM and TON a memo: deposits are told apart
  // by it, and one sent without it cannot be credited.
  const memoLabel = data?.memoType === "tag" ? "Destination tag" : "Memo";
  return (
    <Card className="flex flex-col gap-4">
      <p className="text-sm font-medium text-muted">
        Your {holding.token} address ({holding.network})
      </p>
      {isLoading && <Loading />}
      {error && <Alert>{friendlyErrorMessage(error, "Your address is not ready yet. Try again shortly.")}</Alert>}
      {data && (
        <>
          <AddressQr value={data.address} />
          <p className="select-all break-all text-center font-mono text-sm">{data.address}</p>
          <Button onClick={() => void copy(data.address, "address")}>Copy address</Button>
          {data.memoType && data.memo && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-wash p-4">
              <p className="text-sm font-medium text-muted">{memoLabel}</p>
              <p className="select-all break-all font-mono text-lg font-semibold">{data.memo}</p>
              <Button variant="secondary" onClick={() => void copy(data.memo ?? "", memoLabel.toLowerCase())}>
                Copy {memoLabel.toLowerCase()}
              </Button>
              <p className="text-sm text-danger">
                Always include this {memoLabel.toLowerCase()} when you send {holding.token}. Without it your deposit cannot be
                credited.
              </p>
            </div>
          )}
          <Alert tone="warning">
            Send only {holding.token} on the {data.network} network to this address. Coins sent on any other network are not
            credited and cannot be recovered.
          </Alert>
        </>
      )}
    </Card>
  );
}

function ConvertPanel({ holding }: { holding: TokenHolding }) {
  const queryClient = useQueryClient();
  const { data: balances } = useBalances();
  // The user's own fiat, then USDT: the two things a token converts to.
  const fiat = balances?.find((b) => !isStablecoin(b.currency))?.currency;
  const targets = useMemo(() => [...(fiat ? [fiat] : []), "USDT"], [fiat]);
  const [target, setTarget] = useState<string>("USDT");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<TokenConversionQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const reference = useActionReference("rlz_tconv");

  const value = parseAmount(amount);
  const tooMuch = value !== null && value > holding.balance;
  const { data: rate, isFetching: rateLoading } = useTokenRate(holding.token, target);

  const reset = () => {
    setQuote(null);
    setMessage(null);
  };

  const getQuote = async () => {
    if (value === null) return;
    setBusy(true);
    setMessage(null);
    try {
      setQuote(await quoteConversion({ token: holding.token, amount: value, target }));
    } catch (err) {
      setMessage(friendlyErrorMessage(err, "Could not price that just now."));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (value === null || !quote) return;
    setBusy(true);
    setMessage(null);
    const ref = reference.referenceFor(`${holding.token}:${value}:${target}`);
    try {
      const result = await convertToken({
        token: holding.token,
        amount: value,
        target,
        minReceive: Number(quote.estimatedReceived) * (1 - CONVERSION_TOLERANCE),
        reference: ref,
      });
      reference.settle();
      setQuote(null);
      setAmount("");
      void queryClient.invalidateQueries({ queryKey: TOKENS_KEY });
      void queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
      setMessage(
        result.status === "NEEDS_REVIEW"
          ? "We are checking the result of this conversion. Your balance will update once it is confirmed; there is no need to try again."
          : `Converted. ${fmtToken(result.credited ?? 0, 6)} ${result.target} added to your balance.`,
      );
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "TOKEN_CONVERSION_PRICE_MOVED" || code === "TOKEN_CONVERSION_FAILED") {
        // Nothing converted and the token is back: a new attempt is a new action.
        reference.settle();
        setQuote(null);
      }
      setMessage(
        code === "TOKEN_CONVERSION_PRICE_MOVED"
          ? "The price moved too far, so nothing was converted. Get a new quote to try again."
          : friendlyErrorMessage(err, "The conversion did not go through."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">Convert {holding.token} to</p>
        <div className="flex flex-wrap gap-2">
          {targets.map((t) => (
            <Pill
              key={t}
              label={t}
              selected={target === t}
              onClick={() => {
                setTarget(t);
                reset();
              }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-wash p-4">
        <p className="text-xs text-subtle">Rate</p>
        <p className="truncate text-lg font-semibold tabular">
          {rate
            ? `1 ${holding.token} ≈ ${fmtMoneyIn(rate.perToken, target)}`
            : rateLoading
              ? "Getting the live rate…"
              : "Rate unavailable right now"}
        </p>
        <p className="text-xs text-muted">Live, after fees</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input
          label={`Amount of ${holding.token}`}
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            reset();
          }}
          inputMode="decimal"
          placeholder="0.00"
          error={tooMuch ? `You hold ${fmtToken(holding.balance)} ${holding.token}.` : null}
        />
        <button
          type="button"
          onClick={() => {
            setAmount(String(holding.balance));
            reset();
          }}
          className="w-fit text-sm font-semibold text-primary"
        >
          Use all ({fmtToken(holding.balance)} {holding.token})
        </button>
      </div>

      {!quote && value !== null && rate && !tooMuch && (
        <p className="text-sm text-muted">
          You would receive about <strong className="text-foreground">{fmtMoneyIn(value * rate.perToken, target)}</strong>
        </p>
      )}

      {!quote && (
        <Button onClick={() => void getQuote()} loading={busy} disabled={value === null || tooMuch}>
          Get quote
        </Button>
      )}

      {quote && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <Row label="You convert" value={`${fmtToken(quote.amount)} ${quote.token}`} />
          {quote.rate !== null && <Row label="Rate" value={`1 ${quote.token} ≈ ${fmtToken(quote.rate, 2)} ${quote.target}`} />}
          <Row label="Fee" value={`${fmtToken(quote.estimatedFee, 6)} ${quote.target}`} />
          <Row label="You receive (about)" value={`${fmtToken(quote.estimatedCredited, 6)} ${quote.target}`} strong />
          <p className="text-sm text-muted">
            Converted at the live price when you confirm. If it falls more than {CONVERSION_TOLERANCE * 100}% first, nothing is
            converted.
          </p>
          <Button onClick={() => void confirm()} loading={busy}>
            Confirm conversion
          </Button>
        </div>
      )}
      {message && <Alert tone="info">{message}</Alert>}
    </Card>
  );
}

function SendPanel({ holding }: { holding: TokenHolding }) {
  if (holding.sendable === false) {
    return (
      <Card>
        <p>
          Sending {holding.token} out is not available yet. You can hold it, or convert it to USDT or your own currency.
        </p>
      </Card>
    );
  }
  return <SendForm holding={holding} />;
}

function SendForm({ holding }: { holding: TokenHolding }) {
  const queryClient = useQueryClient();
  const { data: twoFactorEnabled } = useTwoFactorStatus();
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<TokenSendQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const reference = useActionReference("rlz_tsend");

  const value = parseAmount(amount);
  const tooMuch = value !== null && value > holding.balance;
  const needsCode = !!twoFactorEnabled;

  const getQuote = async () => {
    if (value === null) return;
    setBusy(true);
    setMessage(null);
    try {
      setQuote(await quoteTokenSend({ token: holding.token, amount: value }));
    } catch (err) {
      setMessage(friendlyErrorMessage(err, "Could not price that send."));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (value === null || !quote) return;
    setBusy(true);
    setMessage(null);
    const sentCode = needsCode ? code.trim() : "";
    const ref = reference.referenceFor(`${holding.token}:${value}:${toAddress.trim()}`);
    try {
      const result = await sendToken({
        token: holding.token,
        amount: value,
        toAddress: toAddress.trim(),
        twoFactorCode: sentCode || undefined,
        reference: ref,
      });
      reference.settle();
      setQuote(null);
      setAmount("");
      setCode("");
      void queryClient.invalidateQueries({ queryKey: TOKENS_KEY });
      void queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
      setMessage(
        result.status === "NEEDS_REVIEW"
          ? "We are checking this send. There is no need to try again."
          : `Sent. ${fmtToken(result.netAmount)} ${result.asset} is on its way.`,
      );
    } catch (err) {
      if (isTwoFactorRequired(err)) {
        setCode("");
        setMessage(twoFactorMessage(!!sentCode));
      } else {
        setMessage(friendlyErrorMessage(err, "The send did not go through."));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <Input
        label={`${holding.token} address (${holding.network})`}
        value={toAddress}
        onChange={(e) => {
          setToAddress(e.target.value);
          setQuote(null);
        }}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Paste the address"
        className="font-mono"
      />
      <Input
        label={`Amount of ${holding.token}`}
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          setQuote(null);
        }}
        inputMode="decimal"
        placeholder="0.00"
        error={tooMuch ? `You hold ${fmtToken(holding.balance)} ${holding.token}.` : null}
      />
      <Alert tone="warning">
        Only send to a {holding.token} address on the {holding.network} network. A send to any other network cannot be recovered.
      </Alert>

      {!quote && (
        <Button
          onClick={() => void getQuote()}
          loading={busy}
          disabled={value === null || tooMuch || toAddress.trim().length < 10}
        >
          Review send
        </Button>
      )}

      {quote && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <Row label="You send" value={`${fmtToken(quote.amount)} ${quote.token}`} />
          <Row label="Network fee" value={`${fmtToken(quote.networkFee)} ${quote.token}`} />
          <Row label="They receive" value={`${fmtToken(quote.netAmount)} ${quote.token}`} strong />
          <Row label="To" value={toAddress.trim()} />
          {!quote.valid ? (
            <Alert>
              This amount is below the minimum send (about {quote.minSendUsdt} USDT in value).
            </Alert>
          ) : (
            <>
              {needsCode && <CodeInput label="Authenticator code" value={code} onChange={(e) => setCode(e.target.value)} />}
              <Button onClick={() => void confirm()} loading={busy} disabled={needsCode && code.trim().length !== 6}>
                Confirm send
              </Button>
            </>
          )}
        </div>
      )}
      {message && <Alert tone="info">{message}</Alert>}
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span className={`select-all break-all text-right tabular ${strong ? "font-bold text-primary" : "font-semibold"}`}>
        {value}
      </span>
    </div>
  );
}
