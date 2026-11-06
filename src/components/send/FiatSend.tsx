"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CodeInput, Input } from "@/components/ui/Field";
import { ReviewSheet, type ReviewRow } from "@/components/common/ReviewSheet";
import { apiErrorCode, friendlyErrorMessage } from "@/lib/api";
import { useAccounts } from "@/lib/banks";
import { countryName } from "@/lib/countryDisplay";
import { formatMoney, isStablecoin } from "@/lib/currency";
import { featureState, useFeatures } from "@/lib/features";
import { isChargedFee } from "@/lib/fees";
import {
  PAYMENT_PURPOSE_ERROR_CODES,
  PAYMENT_PURPOSE_LABEL,
  PAYMENT_PURPOSE_OPTIONS,
  exchangeRateLabel,
  getWithdrawalQuote,
  initiateGlobalSend,
  isPurposeComplete,
  quoteGlobalSend,
  useCorridors,
  useGlobalSendPreview,
  type GlobalSendBeneficiary,
  type GlobalSendQuote,
  type WithdrawalQuote,
} from "@/lib/globalSend";
import { useActionReference } from "@/lib/idempotency";
import { internationalHref, useInternationalStatus, type InternationalStatus } from "@/lib/international";
import { useKycSummary } from "@/lib/kyc";
import { saveRecipient, touchRecipient, useInvalidateRecipients, useRecipients, type Recipient } from "@/lib/recipients";
import { isTwoFactorRequired, twoFactorMessage } from "@/lib/twoFactor";
import { BALANCES_KEY, balanceOf, useBalances } from "@/lib/wallet";
import { useAuth } from "@/state/auth";
import type { PaymentPurpose } from "@/types/api";
import { EMPTY_CHINA_DETAILS, chinaBeneficiaryFields, chinaMissing, type ChinaSupplierDetails } from "./ChinaSupplierFields";
import { DestinationPicker } from "./DestinationPicker";
import { InvoiceAttach, type AttachedInvoice } from "./InvoiceAttach";
import { PayoutRecipientFields } from "./PayoutRecipientFields";
import { PromptModal, type PromptSpec } from "./PromptModal";
import { PurposeSection } from "./PurposeSection";
import { RecipientChips } from "./RecipientChips";
import { recipientBeneficiary, recipientProblems, type RecipientValues } from "./RecipientSchemaFields";
import { EMPTY_PAYOUT_FIELDS, globalFeeRows, type PayoutFields } from "./payout";

const ADDRESS_LABEL: Record<string, string> = {
  street: "recipient's street address",
  city: "recipient's city",
  state: "recipient's state",
  postalCode: "recipient's postal code",
};

const EXTRA_LABEL: Record<string, string> = {
  routing: "routing number",
  sort: "sort code",
  institution: "institution number",
  transit: "transit number",
};

/**
 * Fiat: a withdrawal to the sender's own default bank account, or a
 * cross-border payout to someone else. Which one is the corridor's to say
 * (settlesToOwnAccount); the country list and per-corridor field
 * requirements all come from useCorridors(), so nothing is hardcoded here
 * beyond the four hand-built forms (US/GB/CA/CN).
 */
export function FiatSend({ asset }: { asset: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // A business may pay someone other than itself; an individual may not, and
  // the server enforces that. The invoice is what licenses it, so it is only
  // asked for here.
  const isBusiness = user?.accountType === "BUSINESS";
  // The uploaded invoice for the payment being composed. Cleared with the
  // rest of the form, so one invoice is never silently reused for the next.
  const [invoice, setInvoice] = useState<AttachedInvoice | null>(null);
  const { data: accounts = [] } = useAccounts();
  const { data: balances } = useBalances();
  const { data: features } = useFeatures();
  const { data: corridors = [] } = useCorridors();
  const kyc = useKycSummary();
  // Only worth reading once Tier 2 is in: below it the tier gate speaks first.
  const { data: international } = useInternationalStatus({
    enabled: kyc.summary.approvedTier >= 2,
  });

  const [targetCountry, setTargetCountry] = useState("");
  // Open on the sender's own country when we support it, so the common case —
  // moving your own money to your own bank — is the default rather than a
  // cross-border send. Otherwise the first corridor the server listed.
  // Applied once: after that the picker is the user's.
  const homeApplied = useRef(false);
  useEffect(() => {
    if (homeApplied.current || !user || corridors.length === 0) return;
    const home = user.country;
    setTargetCountry(home && corridors.some((c) => c.country === home) ? home : corridors[0].country);
    homeApplied.current = true;
  }, [user, corridors]);

  // Idempotency key, one per user action (see useActionReference): minted on
  // the first attempt, reused for a retry of the SAME send after an error or a
  // timeout so the server refuses a second debit, and replaced when the send
  // succeeds or its amount/destination changes.
  const payoutReference = useActionReference("gsend");
  const [fields, setFields] = useState<PayoutFields>(EMPTY_PAYOUT_FIELDS);
  const setField = (patch: Partial<PayoutFields>) => setFields((f) => ({ ...f, ...patch }));
  // China's supplier-payment details: CNAPS, name in Chinese, ID, shipments,
  // invoice and contract.
  const [china, setChina] = useState<ChinaSupplierDetails>(EMPTY_CHINA_DETAILS);
  // A corridor that describes its own recipient form (recipientSchema).
  const [recipientValues, setRecipientValues] = useState<RecipientValues>({});
  const [amount, setAmount] = useState("");
  // Reason for payment: asked on every cross-border send, never on a
  // withdrawal to the sender's own bank. What the sender picked; see
  // `purpose` below for what is sent.
  const [pickedPurpose, setPurpose] = useState<PaymentPurpose | null>(null);
  const [purposeNote, setPurposeNote] = useState("");
  const [purposePickerOpen, setPurposePickerOpen] = useState(false);
  // The server's words when it refused the send for its reason; highlights
  // the picker until the reason is changed.
  const [purposeError, setPurposeError] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // The server's price for the payout under review: fetched when the review
  // opens, so what the sheet shows is what the server will charge.
  const [fiatQuote, setFiatQuote] = useState<
    { kind: "WITHDRAWAL"; quote: WithdrawalQuote } | { kind: "GLOBAL"; quote: GlobalSendQuote } | null
  >(null);
  const [quoting, setQuoting] = useState(false);
  const [prompt, setPrompt] = useState<PromptSpec | null>(null);
  const { data: recipients = [] } = useRecipients();
  const invalidateRecipients = useInvalidateRecipients();
  // The saved recipient the form was filled from, so a send to them bumps
  // them up the list instead of asking to save them again.
  const [chosenRecipient, setChosenRecipient] = useState<Recipient | null>(null);

  const corridor = corridors.find((c) => c.country === targetCountry);
  // Tier required for THIS destination, from the server. Undefined while the
  // corridor list loads: the gate then stays open and the server still refuses.
  const requiredTier = corridor?.minKycLevel;
  const currentTier = kyc.summary.approvedTier;
  const tierShortfall =
    requiredTier !== undefined && currentTier < requiredTier ? { need: requiredTier, have: currentTier } : null;
  const isOwnAccountPayout = !!corridor?.settlesToOwnAccount;
  // Whether our partner abroad still has to onboard the sender for this
  // destination: its status when it does, null when nothing stands in the way.
  const internationalGroup = international?.groups.find((g) => g.countries.includes(targetCountry));
  const internationalGate: InternationalStatus | null =
    !tierShortfall && internationalGroup && internationalGroup.status !== "APPROVED"
      ? internationalGroup.status
      : null;

  // The rail pays this account and no other, so it is shown rather than asked
  // for. If there is none, the send cannot proceed and the form says so.
  const defaultAccount = accounts.find((a) => a.isDefault) ?? null;

  // The sender's local fiat, read off their balances rather than assumed.
  const fiatBalance = balances?.find((b) => !isStablecoin(b.currency));
  const fiatCurrency = fiatBalance?.currency ?? corridor?.currency ?? "";
  const fiatAvailable = balanceOf(balances, fiatCurrency);

  // Driven by what the corridor says it requires, so an older server that
  // does not ask for them is not sent them.
  const isChinaSupplier =
    targetCountry === "CN" && !isOwnAccountPayout && (corridor?.recipientFields?.length ?? 0) > 0;

  // The corridor's own form, where it has one: it replaces the fixed fields.
  const recipientSchema = isOwnAccountPayout
    ? undefined
    : corridor?.recipientSchema?.length
      ? corridor.recipientSchema
      : undefined;

  // China's partner pays out in the recipient's name, whatever an older
  // server says, so the name is always asked for there.
  const needsName = targetCountry === "CN" || (corridor?.needsBeneficiaryName ?? true);
  const extras = corridor?.extraFields ?? [];
  const addressFields = isOwnAccountPayout ? [] : (corridor?.addressFields ?? []);
  const addressValues: Record<string, string> = {
    street: fields.street,
    city: fields.city,
    state: fields.state,
    postalCode: fields.postal,
  };
  const extraValues: Record<string, string> = {
    routing: fields.routingNumber,
    sort: fields.sortCode,
    institution: fields.institutionNumber,
    transit: fields.transitNumber,
  };
  const missingPayoutFields: string[] = isOwnAccountPayout
    ? [defaultAccount ? "" : "a default payout bank account"].filter(Boolean)
    : recipientSchema
      ? recipientProblems(recipientSchema, recipientValues)
      : [
          needsName && !fields.beneficiaryName.trim() ? "beneficiary name" : "",
          !fields.accountNumber.trim() ? "account number" : "",
          ...extras.filter((k) => !extraValues[k]?.trim()).map((k) => EXTRA_LABEL[k]),
          ...addressFields.filter((k) => !addressValues[k]?.trim()).map((k) => ADDRESS_LABEL[k]),
          targetCountry === "CN" && !fields.recipientBank.trim() ? "recipient's bank" : "",
          ...(isChinaSupplier ? chinaMissing(china) : []),
        ].filter(Boolean);
  // The amount is its own gate: present, numeric, and greater than zero.
  const payoutAmount = Number(amount);
  // The rate on the amount form, from a live quote as the user types.
  const preview = useGlobalSendPreview({
    amount: payoutAmount,
    destinationCountry: targetCountry,
    asset,
    enabled: !isOwnAccountPayout,
  });
  const previewRate = preview.data ? exchangeRateLabel(preview.data) : null;
  const amountValid = amount.trim() !== "" && Number.isFinite(payoutAmount) && payoutAmount > 0;
  // Paying your own account spends fiat, so the fiat balance bounds it.
  const overFiatBalance = isOwnAccountPayout && amountValid && payoutAmount > fiatAvailable;
  // A capability the operator has stopped. The server refuses it anyway; this
  // is so the refusal arrives before someone types in a beneficiary.
  const sendFeature = featureState(features, isOwnAccountPayout ? "withdrawal" : "global_send");
  const sendStopped = !sendFeature.enabled;

  // A business paying someone else needs the invoice first. Paying its OWN
  // account is not a third-party payment, so it needs nothing.
  const needsInvoice = isBusiness && !isOwnAccountPayout;

  // A reason is asked for whenever the money crosses a border, and never for
  // moving it to your own bank at home.
  const needsPurpose = !!corridor && !isOwnAccountPayout;
  // Only one reason on offer (China: goods): it is the reason.
  const onlyPurpose = corridor?.allowedPurposes?.length === 1 ? corridor.allowedPurposes[0] : null;
  const purpose = onlyPurpose ?? pickedPurpose;
  const purposeOptions = corridor?.allowedPurposes?.length
    ? PAYMENT_PURPOSE_OPTIONS.filter((o) => corridor.allowedPurposes!.includes(o.value))
    : PAYMENT_PURPOSE_OPTIONS;
  const purposeReady = !needsPurpose || isPurposeComplete(purpose, purposeNote);

  const canInitiatePayout =
    !!corridor &&
    missingPayoutFields.length === 0 &&
    amountValid &&
    !overFiatBalance &&
    !sendStopped &&
    !submitting &&
    (!needsInvoice || invoice !== null) &&
    purposeReady;

  /**
   * Ask the user to verify further, and take them there. Checked on tap
   * rather than by disabling the button: a disabled control with no
   * explanation reads as a broken app.
   */
  const promptTierUpgrade = (need: number, have: number) => {
    // Every level is self-serve. Tier 3 is the address check (a utility bill)
    // and only ever raises limits; sending abroad is a separate international
    // verification, prompted by promptInternational below.
    const destination = need >= 3 ? "/app/kyc-address" : need === 2 ? "/app/kyc-tier2" : "/app/kyc-tier1";
    const place = countryName(targetCountry);
    setPrompt({
      title: `${place} needs Tier ${need}`,
      message:
        have === 0
          ? `Verify your identity to send money to ${place}.`
          : need >= 3
            ? `You are Tier ${have}. Sending to ${place} needs Tier ${need} — proof of your home address.`
            : `You are Tier ${have}. Sending to ${place} needs Tier ${need}.`,
      buttons: [
        { text: "Not now", style: "cancel" },
        { text: "Verify now", onPress: () => router.push(destination) },
      ],
    });
  };

  /**
   * Our partner abroad has to onboard the sender before it will pay out here.
   * Not a tier: it is international verification, with its own status.
   */
  const promptInternational = (status: InternationalStatus) => {
    const place = countryName(targetCountry);
    if (status === "IN_REVIEW") {
      setPrompt({
        title: "International verification in review",
        message: `Our partner is reviewing your details. You can send to ${place} once it is approved.`,
      });
      return;
    }
    setPrompt({
      title: `${place} needs international verification`,
      message:
        "Our partner abroad onboards you in your own name before it will move your money. It uses the details you have already given us.",
      buttons: [
        { text: "Not now", style: "cancel" },
        {
          text: status === "NEEDS_ATTENTION" ? "Try again" : "Apply",
          onPress: () => router.push(internationalHref(targetCountry)),
        },
      ],
    });
  };

  const handleGlobalPayout = async () => {
    if (!canInitiatePayout) return;
    if (tierShortfall) {
      promptTierUpgrade(tierShortfall.need, tierShortfall.have);
      return;
    }
    if (internationalGate) {
      promptInternational(internationalGate);
      return;
    }
    setSubmitting(true);
    const sentCode = needs2fa ? twoFactorCode.trim() : "";
    try {
      // Paying your own account: the backend checks the beneficiary name
      // against the sender's verified identity and refuses anything that is
      // not theirs, so send their real name — a placeholder is rejected.
      const senderName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
      const beneficiary: GlobalSendBeneficiary = isOwnAccountPayout
        ? {
            accountHolderName: senderName,
            accountNumber: defaultAccount?.accountNumber ?? "",
            bankCode: defaultAccount?.bankCode,
          }
        : recipientSchema
          ? recipientBeneficiary(recipientValues)
          : {
              accountHolderName: fields.beneficiaryName.trim() || "Not provided",
              accountNumber: fields.accountNumber.trim(),
              // The rail-specific code, under the field the backend stores.
              bankCode:
                targetCountry === "US"
                  ? fields.routingNumber.trim()
                  : targetCountry === "GB"
                    ? fields.sortCode.trim()
                    : targetCountry === "CA"
                      ? `${fields.institutionNumber.trim()}-${fields.transitNumber.trim()}`
                      : undefined,
              rail: targetCountry === "US" ? fields.usPaymentRail : undefined,
              ...(addressFields.length > 0
                ? {
                    addressLine1: fields.street.trim() || undefined,
                    city: fields.city.trim() || undefined,
                    state: fields.state.trim() || undefined,
                    postalCode: fields.postal.trim() || undefined,
                  }
                : {}),
              extra:
                targetCountry === "CA"
                  ? {
                      institutionNumber: fields.institutionNumber.trim(),
                      transitNumber: fields.transitNumber.trim(),
                    }
                  : targetCountry === "CN"
                    ? { bankName: fields.recipientBank.trim() }
                    : undefined,
              ...(isChinaSupplier ? chinaBeneficiaryFields(china) : {}),
            };
      // Part of the action: a different reason is a different send, so it
      // gets its own reference rather than replaying the first one.
      const purposeFields: { purpose?: PaymentPurpose; purposeNote?: string } =
        needsPurpose && purpose
          ? { purpose, ...(purpose === "OTHER" ? { purposeNote: purposeNote.trim() } : {}) }
          : {};
      const reference = payoutReference.referenceFor(
        JSON.stringify({
          amount: payoutAmount,
          destinationCountry: targetCountry,
          asset,
          beneficiary,
          invoiceId: isBusiness && invoice ? invoice.id : null,
          purpose: purposeFields.purpose ?? null,
          purposeNote: purposeFields.purposeNote ?? null,
        }),
      );
      const result = await initiateGlobalSend({
        amount: payoutAmount,
        destinationCountry: targetCountry,
        asset,
        reference,
        beneficiary,
        ...purposeFields,
        twoFactorCode: sentCode || undefined,
        // Only a business sends one. The server requires it from them and
        // ignores it from anyone else, so the rule stays in one place.
        ...(isBusiness && invoice ? { invoiceId: invoice.id } : {}),
      });
      // Bump a saved recipient, or offer to save a new one, once the send is
      // accepted. Done before the fields are cleared below.
      const alreadySaved =
        (!isOwnAccountPayout &&
          (chosenRecipient?.accountNumber === beneficiary.accountNumber
            ? chosenRecipient
            : recipients.find(
                (r) =>
                  r.kind === "BANK" && r.country === targetCountry && r.accountNumber === beneficiary.accountNumber,
              ))) ||
        null;
      if (alreadySaved) touchRecipient(alreadySaved.id);
      const offerSave = !isOwnAccountPayout && !alreadySaved;
      const toSave = offerSave
        ? {
            kind: "BANK" as const,
            label: beneficiary.accountHolderName,
            country: targetCountry,
            currency: corridor?.currency,
            accountHolderName: beneficiary.accountHolderName,
            accountNumber: beneficiary.accountNumber,
            bankCode: beneficiary.bankCode,
            rail: beneficiary.rail,
            // The address rides along so a repeat send needs no retyping.
            extra: beneficiary.addressLine1
              ? {
                  ...(beneficiary.extra as Record<string, string> | undefined),
                  addressLine1: beneficiary.addressLine1 ?? "",
                  city: beneficiary.city ?? "",
                  state: beneficiary.state ?? "",
                  postalCode: beneficiary.postalCode ?? "",
                }
              : (beneficiary.extra as Record<string, string> | undefined),
          }
        : null;
      // Drop the spent key so the next payout mints its own.
      payoutReference.settle();
      setFields((f) => ({ ...EMPTY_PAYOUT_FIELDS, usPaymentRail: f.usPaymentRail }));
      setChina(EMPTY_CHINA_DETAILS);
      setRecipientValues({});
      setAmount("");
      setChosenRecipient(null);
      // The server has claimed this invoice for the payment just made, so it
      // cannot be used again.
      setInvoice(null);
      setPurpose(null);
      setPurposeNote("");
      setPurposeError(null);
      await queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
      setPrompt({
        title: isOwnAccountPayout ? "Withdrawal initiated" : "Payout submitted",
        message: isOwnAccountPayout
          ? `${formatMoney(payoutAmount, fiatCurrency)} is on its way to your bank account.`
          : `${result.assetAmount ?? payoutAmount} ${result.asset ?? asset} is being sent to our ${result.corridor} partner, who will pay the recipient in ${result.currency}.`,
        buttons: toSave
          ? [
              {
                text: "Save recipient",
                onPress: () => {
                  void saveRecipient(toSave).then(invalidateRecipients);
                },
              },
              { text: "Done", style: "cancel" },
            ]
          : undefined,
      });
    } catch (err) {
      if (isTwoFactorRequired(err)) {
        // Codes are single-use: a refused one is cleared, not resubmitted.
        // The reference is unchanged, so confirming again is the same send.
        setNeeds2fa(true);
        setTwoFactorCode("");
        setPrompt({
          title: sentCode ? "Code not accepted" : "Two-factor required",
          message: twoFactorMessage(!!sentCode),
        });
      } else if (PAYMENT_PURPOSE_ERROR_CODES.has(apiErrorCode(err) ?? "")) {
        // The server's message is customer-ready. Point at the picker.
        const message = friendlyErrorMessage(err, "Choose a reason for this payment.");
        setPurposeError(message);
        setPrompt({
          title: "Reason for payment",
          message,
          buttons: [
            { text: "Not now", style: "cancel" },
            {
              text: purpose === "OTHER" ? "Edit reason" : "Choose a reason",
              onPress: () => setPurposePickerOpen(true),
            },
          ],
        });
      } else {
        setPrompt({ title: "Payout failed", message: friendlyErrorMessage(err, "Please try again.") });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // The tier gate runs before the review, so nobody reviews a send they
  // cannot make.
  const openFiatReview = async () => {
    if (!canInitiatePayout || quoting) return;
    if (tierShortfall) {
      promptTierUpgrade(tierShortfall.need, tierShortfall.have);
      return;
    }
    if (internationalGate) {
      promptInternational(internationalGate);
      return;
    }
    // Price it first. Nobody confirms a payout without seeing the fee and
    // what arrives, and those are the server's numbers, not ours to guess.
    setQuoting(true);
    try {
      setFiatQuote(
        isOwnAccountPayout
          ? { kind: "WITHDRAWAL", quote: await getWithdrawalQuote(payoutAmount) }
          : {
              kind: "GLOBAL",
              quote: await quoteGlobalSend({ amount: payoutAmount, destinationCountry: targetCountry, asset }),
            },
      );
      setReviewOpen(true);
    } catch (err) {
      setPrompt({ title: "Could not price this payout", message: friendlyErrorMessage(err, "Please try again.") });
    } finally {
      setQuoting(false);
    }
  };

  const fillFromRecipient = (r: Recipient) => {
    setChosenRecipient(r);
    setFields((f) => ({
      ...f,
      beneficiaryName: r.accountHolderName ?? "",
      accountNumber: r.accountNumber ?? "",
      ...(targetCountry === "US"
        ? {
            routingNumber: r.bankCode ?? "",
            ...(r.rail === "ACH" || r.rail === "WIRE" ? { usPaymentRail: r.rail } : {}),
          }
        : {}),
      ...(targetCountry === "GB" ? { sortCode: r.bankCode ?? "" } : {}),
      recipientBank: r.extra?.bankName ?? "",
      street: r.extra?.addressLine1 ?? "",
      city: r.extra?.city ?? "",
      state: r.extra?.state ?? "",
      postal: r.extra?.postalCode ?? "",
      ...(targetCountry === "CA"
        ? {
            institutionNumber: r.extra?.institutionNumber ?? "",
            transitNumber: r.extra?.transitNumber ?? "",
          }
        : {}),
    }));
  };

  // Money in the quote's own currency. A stablecoin is shown as a plain
  // figure and code, the way the rest of this screen shows coins.
  const money = (value: number, currency: string) =>
    isStablecoin(currency) ? `${value} ${currency}` : formatMoney(value, currency);
  const withdrawalQuote = fiatQuote?.kind === "WITHDRAWAL" ? fiatQuote.quote : null;
  const globalQuote = fiatQuote?.kind === "GLOBAL" ? fiatQuote.quote : null;
  const reviewRows: ReviewRow[] = isOwnAccountPayout
    ? [
        [
          "To",
          defaultAccount ? `Your account ••••${defaultAccount.accountNumber.slice(-4)}` : "Your default bank account",
        ],
        ...(withdrawalQuote
          ? ([
              ["Amount", money(withdrawalQuote.totalDebited, withdrawalQuote.currency)],
              ...(isChargedFee(withdrawalQuote.fee)
                ? ([["Withdrawal fee", money(withdrawalQuote.fee, withdrawalQuote.currency)]] satisfies ReviewRow[])
                : []),
              ["You receive", money(withdrawalQuote.amount, withdrawalQuote.currency)],
            ] satisfies ReviewRow[])
          : []),
      ]
    : [
        ...(recipientSchema
          ? (recipientSchema
              .filter((f) => recipientValues[f.key]?.trim())
              .map((f) => [f.label, recipientValues[f.key]!.trim()] as const) satisfies ReviewRow[])
          : ([["Recipient", fields.beneficiaryName.trim() || "—"]] satisfies ReviewRow[])),
        ...(targetCountry === "CN" ? ([["Bank", fields.recipientBank.trim() || "—"]] satisfies ReviewRow[]) : []),
        ...(isChinaSupplier
          ? ([
              ["CNAPS code", china.cnaps.trim() || "—"],
              ["Name in Chinese", china.nameInChinese.trim() || "—"],
              [
                "Shipment",
                china.tracking
                  .filter((t) => t.trackingNumber.trim())
                  .map((t) => `${t.carrierName.trim()} ${t.trackingNumber.trim()}`)
                  .join(", ") || "—",
              ],
              [
                "Documents",
                [china.invoice && "Invoice", china.contract && "Contract"].filter(Boolean).join(", ") || "—",
              ],
            ] satisfies ReviewRow[])
          : []),
        ["Account", fields.accountNumber.trim() || "—"],
        ["Destination", `${countryName(targetCountry)}${corridor?.currency ? ` (${corridor.currency})` : ""}`],
        ...(purpose
          ? ([
              ["Reason", PAYMENT_PURPOSE_LABEL[purpose]],
              ...(purpose === "OTHER" && purposeNote.trim()
                ? ([["Details", purposeNote.trim()]] satisfies ReviewRow[])
                : []),
            ] satisfies ReviewRow[])
          : []),
        ...(globalQuote
          ? ([
              ["Amount", money(globalQuote.sourceAmount, globalQuote.sourceCurrency)],
              ...globalFeeRows(globalQuote, money),
              ["Sent as", money(globalQuote.assetAmount, globalQuote.asset)],
              [
                "Recipient gets",
                globalQuote.estimatedDestinationAmount !== null
                  ? `≈ ${money(globalQuote.estimatedDestinationAmount, globalQuote.destinationCurrency)}`
                  : `Set in ${globalQuote.destinationCurrency} at payout`,
              ],
            ] satisfies ReviewRow[])
          : []),
      ];

  const hint = "text-sm text-warning";

  return (
    <Card className="flex flex-col gap-4">
      <DestinationPicker corridors={corridors} value={targetCountry} onChange={setTargetCountry} />

      {/* Shown as well as the tap-time prompt: the requirement is worth
          knowing BEFORE filling in a beneficiary, not after. */}
      {!tierShortfall && internationalGate && (
        <button
          type="button"
          onClick={() => promptInternational(internationalGate)}
          className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-left text-sm text-warning"
        >
          {internationalGate === "IN_REVIEW"
            ? "Your international verification is in review."
            : "Sending here needs international verification. Tap to apply."}
        </button>
      )}
      {tierShortfall && (
        <button
          type="button"
          onClick={() => promptTierUpgrade(tierShortfall.need, tierShortfall.have)}
          className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-left text-sm text-warning"
        >
          Sending here needs Tier {tierShortfall.need} verification. Tap to verify.
        </button>
      )}

      {!isOwnAccountPayout && (
        <RecipientChips
          items={recipients.filter((r) => r.kind === "BANK" && r.country === targetCountry)}
          onSelect={fillFromRecipient}
        />
      )}

      <PayoutRecipientFields
        ownAccount={isOwnAccountPayout}
        targetCountry={targetCountry}
        currency={corridor?.currency}
        fields={fields}
        onChange={setField}
        needsName={needsName}
        addressFields={addressFields}
        recipientSchema={recipientSchema}
        recipientValues={recipientValues}
        onRecipientValues={setRecipientValues}
        isChinaSupplier={isChinaSupplier}
        china={china}
        onChina={setChina}
      />

      {isOwnAccountPayout && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">To your bank account</p>
          {defaultAccount ? (
            <div className="rounded-xl border border-border bg-background px-4 py-3">
              <p className="font-mono font-semibold tabular">{defaultAccount.accountNumber}</p>
              <p className="text-sm text-muted">Default payout account</p>
            </div>
          ) : (
            <p className={hint}>You have no default payout account yet. Add one to withdraw.</p>
          )}
          <Link href="/app/bank-accounts" className="w-fit text-sm font-medium text-primary">
            {defaultAccount ? "Change default account" : "Add a bank account"}
          </Link>
          {fiatCurrency !== "" && (
            <p className="text-sm text-muted">Available: {formatMoney(fiatAvailable, fiatCurrency)}</p>
          )}
        </div>
      )}

      <Input
        label={isOwnAccountPayout ? `Amount (${fiatCurrency})` : `Payout Amount (${asset})`}
        placeholder="0.00"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        hint={
          !isOwnAccountPayout && corridor?.minAssetAmount
            ? `Minimum ${corridor.minAssetAmount} ${asset} after fees.`
            : undefined
        }
      />

      {!isOwnAccountPayout && targetCountry !== "" && (
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">You send</dt>
              <dd className="font-semibold tabular">
                {preview.data && payoutAmount > 0
                  ? formatMoney(preview.data.sourceAmount, preview.data.sourceCurrency)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">They receive</dt>
              <dd className="font-semibold tabular">
                {preview.data && payoutAmount > 0
                  ? preview.data.estimatedDestinationAmount !== null
                    ? `≈ ${formatMoney(preview.data.estimatedDestinationAmount, preview.data.destinationCurrency)}`
                    : `Paid in ${preview.data.destinationCurrency}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-2">
              <dt className="text-muted">Exchange rate</dt>
              <dd className="tabular">
                {previewRate ??
                  (preview.isFetching
                    ? "Checking…"
                    : payoutAmount > 0
                      ? preview.isError
                        ? "Shown at review"
                        : "Set at payout"
                      : "Enter an amount")}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">An estimate, after fees. Confirmed when you review.</p>
        </div>
      )}

      {needsPurpose && (
        <PurposeSection
          purpose={purpose}
          options={purposeOptions}
          note={purposeNote}
          error={purposeError}
          pickerOpen={purposePickerOpen}
          onPickerOpen={setPurposePickerOpen}
          onPick={(value) => {
            setPurpose(value);
            setPurposeError(null);
          }}
          onNote={(text) => {
            setPurposeNote(text);
            setPurposeError(null);
          }}
        />
      )}

      {missingPayoutFields.length > 0 && <p className={hint}>Still needed: {missingPayoutFields.join(", ")}.</p>}
      {missingPayoutFields.length === 0 && !amountValid && (
        <p className={hint}>Enter a payout amount greater than zero.</p>
      )}
      {sendStopped && (
        <p className={hint}>
          {sendFeature.message?.trim() ||
            (sendFeature.status === "COMING_SOON"
              ? "This is not available yet. We will let you know when it is."
              : "This is temporarily unavailable. Please try again later.")}
        </p>
      )}
      {overFiatBalance && (
        <p className={hint}>That is more than your {formatMoney(fiatAvailable, fiatCurrency)} balance.</p>
      )}

      {needsInvoice && <InvoiceAttach invoice={invoice} onChange={setInvoice} />}

      {needs2fa && (
        <CodeInput label="Authenticator code" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} />
      )}

      <Button
        block
        loading={submitting || quoting}
        disabled={!canInitiatePayout || quoting}
        onClick={() => void openFiatReview()}
      >
        {isOwnAccountPayout ? "Withdraw to bank" : "Review payout"}
      </Button>

      <ReviewSheet
        visible={reviewOpen}
        title={isOwnAccountPayout ? "Withdraw to bank" : `Send to ${countryName(targetCountry)}`}
        rows={reviewRows}
        note={
          isOwnAccountPayout
            ? "Usually arrives within the hour; some banks take longer."
            : "Delivered by our local partner, usually within one to two business days."
        }
        confirmLabel={
          withdrawalQuote ? `Withdraw ${money(withdrawalQuote.totalDebited, withdrawalQuote.currency)}` : "Confirm"
        }
        onConfirm={handleGlobalPayout}
        onClose={() => {
          setReviewOpen(false);
          setFiatQuote(null);
        }}
      />
      <PromptModal prompt={prompt} onClose={() => setPrompt(null)} />
    </Card>
  );
}
