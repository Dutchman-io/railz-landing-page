"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CodeInput, Input } from "@/components/ui/Field";
import { CurrencyPicker } from "@/components/common/CurrencyPicker";
import { ReviewSheet, type ReviewRow } from "@/components/common/ReviewSheet";
import { friendlyErrorMessage } from "@/lib/api";
import { metaOrCode } from "@/lib/currency";
import { featureState, useFeatures } from "@/lib/features";
import { isChargedFee } from "@/lib/fees";
import { useActionReference } from "@/lib/idempotency";
import { networkLabel } from "@/lib/networks";
import { saveRecipient, shortAddress, touchRecipient, useInvalidateRecipients, useRecipients, type Recipient } from "@/lib/recipients";
import {
  SEND_NETWORKS_KEY,
  parseAddressFromQr,
  quoteSend,
  sendCrypto,
  type SendAsset,
  type SendNetworksResponse,
  type SendQuote,
} from "@/lib/send";
import { isTwoFactorRequired, twoFactorMessage } from "@/lib/twoFactor";
import { BALANCES_KEY } from "@/lib/wallet";
import { PromptModal, type PromptSpec } from "./PromptModal";
import { RecipientChips } from "./RecipientChips";

/** On-chain send of a stablecoin to a wallet address. */
export function CryptoSend({
  data,
  assets,
  asset,
  onAsset,
}: {
  data: SendNetworksResponse | undefined;
  assets: SendAsset[];
  asset: SendAsset;
  onAsset: (asset: SendAsset) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: features } = useFeatures();
  const cryptoReference = useActionReference("send");
  const [network, setNetwork] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // The server's price for the send under review, fetched when the review
  // opens: the network fee and ZemFi's fee both come out of the amount, and
  // only the server knows ZemFi's.
  const [cryptoQuote, setCryptoQuote] = useState<SendQuote | null>(null);
  const [cryptoQuoting, setCryptoQuoting] = useState(false);
  const [prompt, setPrompt] = useState<PromptSpec | null>(null);
  const { data: recipients = [] } = useRecipients();
  const invalidateRecipients = useInvalidateRecipients();
  const [chosenRecipient, setChosenRecipient] = useState<Recipient | null>(null);

  const balance = data?.balances?.[asset] ?? 0;
  // Rendered from the catalogue so a new asset needs no change here.
  const assetOptions = useMemo(() => assets.map(metaOrCode), [assets]);

  // Networks that support the chosen asset; cheapest first so the recommended
  // one leads.
  const networks = useMemo(() => {
    const list = (data?.networks ?? []).filter((n) => n.assets.includes(asset));
    return [...list].sort((a, b) => a.flatFeeUsdt - b.flatFeeUsdt);
  }, [data, asset]);

  const selected = networks.find((n) => n.network === network) ?? networks[0];
  const fee = selected?.flatFeeUsdt ?? 0;
  const min = selected?.minSendUsdt ?? 0;

  const numeric = Number(amount.replace(/[^0-9.]/g, ""));
  const net = numeric > 0 ? Math.max(Number((numeric - fee).toFixed(6)), 0) : 0;
  const overBalance = numeric > balance;
  const underMin = numeric > 0 && numeric < min;
  // The on-chain send is its own capability, separate from the fiat corridors.
  const cryptoFeature = featureState(features, "crypto_send");
  const cryptoStopped = !cryptoFeature.enabled;

  const canSubmit =
    !!selected &&
    toAddress.trim().length > 0 &&
    numeric >= min &&
    !overBalance &&
    net > 0 &&
    !cryptoStopped &&
    !submitting;

  const onSubmit = async () => {
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    const sentCode = needs2fa ? twoFactorCode.trim() : "";
    try {
      // The 2FA code is not part of the action: resubmitting with a code is a
      // retry of the same send and must carry the same reference.
      const sendInput = {
        asset,
        amount: numeric,
        network: selected.network,
        toAddress: toAddress.trim(),
      };
      const result = await sendCrypto({
        ...sendInput,
        twoFactorCode: sentCode || undefined,
        reference: cryptoReference.referenceFor(JSON.stringify(sendInput)),
      });
      cryptoReference.settle();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: BALANCES_KEY }),
        queryClient.invalidateQueries({ queryKey: SEND_NETWORKS_KEY }),
      ]);
      const address = toAddress.trim();
      const alreadySaved =
        chosenRecipient?.address === address
          ? chosenRecipient
          : (recipients.find(
              (r) => r.kind === "CRYPTO" && r.address === address && r.network === selected.network,
            ) ?? null);
      if (alreadySaved) touchRecipient(alreadySaved.id);
      const done = () => router.push("/app");
      setPrompt({
        title: "Send submitted",
        message: `${result.netAmount} ${asset} is on its way on ${networkLabel(selected.network)}.`,
        buttons: alreadySaved
          ? [{ text: "Done", onPress: done }]
          : [
              {
                text: "Save recipient",
                onPress: () => {
                  void saveRecipient({
                    kind: "CRYPTO",
                    label: shortAddress(address),
                    asset,
                    network: selected.network,
                    address,
                  })
                    .then(invalidateRecipients)
                    .finally(done);
                },
              },
              { text: "Done", style: "cancel", onPress: done },
            ],
      });
    } catch (err) {
      if (isTwoFactorRequired(err)) {
        // Codes are single-use: a refused one is cleared, not resubmitted.
        setNeeds2fa(true);
        setTwoFactorCode("");
        setPrompt({
          title: sentCode ? "Code not accepted" : "Two-factor required",
          message: twoFactorMessage(!!sentCode),
        });
      } else {
        setPrompt({
          title: "Send failed",
          message: friendlyErrorMessage(err, "Something went wrong. Your balance was not affected."),
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Price the send on the server before the review opens, so every fee the
  // sheet shows -- and "Recipient gets" -- is the server's own figure.
  const openCryptoReview = async () => {
    if (!canSubmit || !selected || cryptoQuoting) return;
    setCryptoQuoting(true);
    try {
      const priced = await quoteSend({ asset, amount: numeric, network: selected.network });
      if (!priced.valid) {
        setPrompt({
          title: "Cannot send this amount",
          message: !priced.sufficientBalance
            ? `Amount exceeds your ${asset} balance.`
            : !priced.meetsMin
              ? `Minimum on ${networkLabel(selected.network)} is ${priced.minSendUsdt} ${asset}.`
              : "The amount does not cover the fees.",
        });
        return;
      }
      setCryptoQuote(priced);
      setReviewOpen(true);
    } catch (err) {
      setPrompt({ title: "Could not price this send", message: friendlyErrorMessage(err, "Please try again.") });
    } finally {
      setCryptoQuoting(false);
    }
  };

  const cryptoAddress = toAddress.trim();
  const reviewRows: ReviewRow[] = [
    [
      "To",
      chosenRecipient?.address === cryptoAddress
        ? `${chosenRecipient.label} · ${shortAddress(cryptoAddress)}`
        : shortAddress(cryptoAddress),
    ],
    ["Network", selected ? networkLabel(selected.network) : "—"],
    // All from the server's quote: Recipient gets = Amount - Network fee -
    // ZemFi fee, exactly as the send will settle.
    ...(cryptoQuote
      ? ([
          ["Amount", `${cryptoQuote.amount} ${cryptoQuote.asset}`],
          ["Network fee", `${cryptoQuote.fee} ${cryptoQuote.asset}`],
          ...(isChargedFee(cryptoQuote.partnerFee)
            ? ([["ZemFi fee", `${cryptoQuote.partnerFee} ${cryptoQuote.asset}`]] satisfies ReviewRow[])
            : []),
          ["Recipient gets", `${cryptoQuote.netAmount} ${cryptoQuote.asset}`],
        ] satisfies ReviewRow[])
      : []),
  ];

  return (
    <>
      <Card className="flex flex-col gap-4">
        {/* A dropdown, so the list can grow without this screen deciding how
            many fit in a row. */}
        <CurrencyPicker label="Asset" options={assetOptions} value={asset} onChange={(code) => onAsset(code)} />
        <p className="text-sm text-muted">
          Balance: {balance} {asset}
        </p>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Network</p>
          <div className="flex flex-col gap-2">
            {networks.map((n) => {
              const active = selected?.network === n.network;
              return (
                <button
                  key={n.network}
                  type="button"
                  onClick={() => setNetwork(n.network)}
                  aria-pressed={active}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    active ? "border-primary bg-wash" : "border-border hover:border-primary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{networkLabel(n.network)}</span>
                    {n.recommended && (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                        Cheapest
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted tabular">fee {n.flatFeeUsdt}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <RecipientChips
          items={recipients.filter((r) => r.kind === "CRYPTO")}
          onSelect={(r) => {
            setChosenRecipient(r);
            setToAddress(r.address ?? "");
            if (r.network) setNetwork(r.network);
            // Only if the backend still lists it: a recipient saved against a
            // coin since turned off must not re-select it.
            if (r.asset && assets.includes(r.asset)) onAsset(r.asset);
          }}
        />
        <Input
          label="Destination address"
          placeholder="Paste wallet address"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          // A pasted payment URI ("tron:T...?amount=1") is reduced to its
          // address, as a scanned QR was on mobile.
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted && /^[a-zA-Z]+:/.test(pasted.trim())) {
              e.preventDefault();
              setToAddress(parseAddressFromQr(pasted));
            }
          }}
        />
        <Input
          label={`Amount (${asset})`}
          placeholder="0.00"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {overBalance && <p className="text-sm text-danger">Amount exceeds your {asset} balance.</p>}
        {underMin && (
          <p className="text-sm text-danger">
            Minimum on {selected ? networkLabel(selected.network) : "this network"} is {min} {asset}.
          </p>
        )}
        {numeric > 0 && !overBalance && !underMin && (
          <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted">Network fee</span>
              <span className="tabular">
                {fee} {asset}
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-muted">Recipient gets (est.)</span>
              <span className="font-semibold tabular">
                {net} {asset}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">Any ZemFi fee is shown on the next step, before you confirm.</p>
          </div>
        )}
        {needs2fa && (
          <CodeInput label="Authenticator code" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} />
        )}
        {cryptoStopped && (
          <p className="text-sm text-warning">
            {cryptoFeature.message?.trim() ||
              (cryptoFeature.status === "COMING_SOON"
                ? "Sending crypto is not available yet."
                : "Sending crypto is temporarily unavailable.")}
          </p>
        )}
        <Button
          block
          onClick={() => void openCryptoReview()}
          loading={submitting || cryptoQuoting}
          disabled={!canSubmit}
        >
          Review send
        </Button>
      </Card>

      <ReviewSheet
        visible={reviewOpen}
        title={`Send ${asset}`}
        rows={reviewRows}
        note="Usually confirms within a few minutes. On-chain sends cannot be reversed, so check the address."
        confirmLabel={`Send ${cryptoQuote?.netAmount ?? net} ${asset}`}
        onConfirm={onSubmit}
        onClose={() => {
          setReviewOpen(false);
          setCryptoQuote(null);
        }}
      />
      <PromptModal prompt={prompt} onClose={() => setPrompt(null)} />
    </>
  );
}
