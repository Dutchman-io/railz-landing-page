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
import { ReviewSheet, type ReviewRow } from "@/components/common/ReviewSheet";
import { Pill } from "@/components/convert/Chips";
import { friendlyErrorMessage } from "@/lib/api";
import { featureState, useFeatures } from "@/lib/features";
import { useActionReference } from "@/lib/idempotency";
import { isTwoFactorRequired, twoFactorMessage } from "@/lib/twoFactor";
import { BALANCES_KEY, balanceOf, useBalances } from "@/lib/wallet";
import { formatMoney } from "@/lib/currency";
import { useAuth } from "@/state/auth";
import {
  BILL_TYPES,
  BILL_TYPE_INFO,
  QUICK_AMOUNTS,
  hasPlans,
  isPhoneBill,
  needsValidation,
  nigerianMobile,
  payBill,
  quoteBill,
  RECENT_BILLS_KEY,
  useBillCategories,
  useBillProducts,
  useRecentBills,
  validateBill,
  type BillCategory,
  type BillPayment,
  type BillProduct,
  type BillQuote,
  type BillType,
  type BillValidation,
  type RecentBill,
} from "@/lib/bills";

const naira = (n: number) => formatMoney(n, "NGN");

/**
 * Airtime, data, cable TV and electricity from the NGN balance: pick the
 * service and provider, enter the number (checked with the biller for TV and
 * electricity), choose a plan or an amount, then review the server's quote.
 * Money only moves from the review sheet's confirm.
 */
export default function BillsPage() {
  const { data: features } = useFeatures();
  const feature = featureState(features, "bills");
  if (feature.status === "COMING_SOON") return <BillsComingSoon />;
  if (feature.status === "OFF") {
    return (
      <div className="mx-auto max-w-2xl">
        <Header />
        <Card className="border-primary">
          <p className="font-semibold">Bill payments are paused</p>
          <p className="mt-1 text-muted">
            {feature.message ?? "We have paused bill payments for a moment. Please try again later."}
          </p>
        </Card>
      </div>
    );
  }
  return <BillsForm />;
}

function Header({ balance }: { balance?: number }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Bills</p>
      <PageHeader
        title="Pay bills"
        subtitle={
          balance === undefined
            ? "Airtime, data, electricity and TV, paid straight from your ZemFi balance."
            : `Paid from your naira balance: ${naira(balance)} available.`
        }
      />
    </>
  );
}

function TypeTile({ type, selected, onClick, soon }: { type: BillType; selected?: boolean; onClick?: () => void; soon?: boolean }) {
  const body = (
    <>
      {soon && <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-primary">Soon</span>}
      <span className="block font-semibold">{BILL_TYPE_INFO[type].title}</span>
      <span className="block text-sm text-muted">{BILL_TYPE_INFO[type].body}</span>
    </>
  );
  const cls = `rounded-2xl border p-4 text-left ${selected ? "border-primary bg-wash" : "border-border bg-surface"}`;
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${cls} transition-colors hover:border-primary`}>
      {body}
    </button>
  );
}

function BillsForm() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: balances } = useBalances();
  const balance = balanceOf(balances, "NGN");
  const ownPhone = nigerianMobile(user?.phoneNumber);
  const reference = useActionReference("bill");

  const [type, setType] = useState<BillType>("AIRTIME");
  const [category, setCategory] = useState<BillCategory | null>(null);
  const [product, setProduct] = useState<BillProduct | null>(null);
  /** null: the user's own phone, for airtime and data. */
  const [identifier, setIdentifier] = useState<string | null>(null);
  const [validation, setValidation] = useState<BillValidation | null>(null);
  const [amount, setAmount] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [payNotice, setPayNotice] = useState<{ title: string; body: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<BillQuote | null>(null);
  const [result, setResult] = useState<BillPayment | null>(null);

  const categories = useBillCategories(type);
  const recents = useRecentBills(type);
  const products = useBillProducts(category && hasPlans(type) ? category.id : undefined);
  const info = BILL_TYPE_INFO[type];
  const value = identifier ?? (isPhoneBill(type) ? (ownPhone ?? "") : "");
  const fixedPrice = product?.isAmountFixed && product.amount ? product.amount : null;
  const showAmount = !hasPlans(type) || (!!product && !fixedPrice);
  const faceValue = fixedPrice ?? Number(amount || 0);

  const pickType = (t: BillType) => {
    if (t === type) return;
    setType(t);
    setCategory(null);
    setProduct(null);
    setIdentifier(null);
    setValidation(null);
    setAmount("");
    setIdError(null);
    setFormError(null);
  };

  const pickCategory = (c: BillCategory) => {
    if (c.id === category?.id) return;
    setCategory(c);
    setProduct(null);
    setValidation(null);
    setFormError(null);
  };

  const changeIdentifier = (v: string) => {
    setIdentifier(isPhoneBill(type) ? v.replace(/[^\d+\s]/g, "").slice(0, 16) : v.replace(/\D/g, "").slice(0, 20));
    setIdError(null);
    setValidation(null);
  };

  /** Fill in a number paid before, with its provider; a meter or smartcard is checked straight away. */
  const pickRecent = (r: RecentBill) => {
    const c = categories.data?.find((x) => x.id === r.categoryId);
    if (c && c.id !== category?.id) {
      setCategory(c);
      setProduct(null);
    }
    setIdentifier(r.customerIdentifier);
    setValidation(null);
    setIdError(null);
    setFormError(null);
    if (c && needsValidation(type)) void check(c, r.customerIdentifier);
  };

  /** The number as the biller takes it, or null with a field error. */
  const payableIdentifier = (raw = value): string | null => {
    if (isPhoneBill(type)) {
      const phone = nigerianMobile(raw);
      if (!phone) setIdError("Enter a Nigerian mobile number, like 0803 123 4567");
      return phone;
    }
    const digits = raw.replace(/\s/g, "");
    if (!/^\d{6,20}$/.test(digits)) {
      setIdError(`Enter the ${info.identifier.toLowerCase()}`);
      return null;
    }
    return digits;
  };

  const check = async (cat = category, raw = value) => {
    if (!cat) return setFormError(`Choose a ${info.provider.toLowerCase()}`);
    const id = payableIdentifier(raw);
    if (!id) return;
    setChecking(true);
    try {
      setValidation(await validateBill({ categoryId: cat.id, customerIdentifier: id }));
    } catch (err) {
      setIdError(friendlyErrorMessage(err, "We could not check that number. Try again."));
    } finally {
      setChecking(false);
    }
  };

  const review = async () => {
    setFormError(null);
    setPayNotice(null);
    if (!category) return setFormError(`Choose a ${info.provider.toLowerCase()}`);
    const id = payableIdentifier();
    if (!id) return;
    if (needsValidation(type) && !validation) return void check();
    if (hasPlans(type) && !product) return setFormError("Choose a plan");
    if (!fixedPrice) {
      if (!Number.isInteger(faceValue) || faceValue <= 0) {
        return setFormError("Enter an amount in whole naira");
      }
      if (validation?.minAmount && faceValue < validation.minAmount) {
        return setFormError(`The least you can pay is ${naira(validation.minAmount)}`);
      }
      if (validation?.maxAmount && faceValue > validation.maxAmount) {
        return setFormError(`The most you can pay is ${naira(validation.maxAmount)}`);
      }
    }
    setQuoting(true);
    try {
      const q = await quoteBill({
        type,
        categoryId: category.id,
        productCode: product?.code,
        amount: fixedPrice ? undefined : faceValue,
      });
      if (q.totalDebited > balance) {
        return setFormError(`You need ${naira(q.totalDebited)}, and your balance is ${naira(balance)}.`);
      }
      setQuote(q);
    } catch (err) {
      setFormError(friendlyErrorMessage(err, "We could not price this bill. Try again."));
    } finally {
      setQuoting(false);
    }
  };

  const pay = async () => {
    if (!category || !quote) return;
    const customerIdentifier = payableIdentifier();
    if (!customerIdentifier) return;
    const sentCode = needs2fa ? twoFactorCode.trim() : "";
    // The 2FA code is not part of the action: resubmitting with a code is a
    // retry of the same payment and must carry the same reference.
    const input = {
      type,
      categoryId: category.id,
      productCode: product?.code,
      amount: fixedPrice ? undefined : faceValue,
      customerIdentifier,
    };
    try {
      const paid = await payBill({
        ...input,
        twoFactorCode: sentCode || undefined,
        reference: reference.referenceFor(JSON.stringify(input)),
      });
      reference.settle();
      setNeeds2fa(false);
      setTwoFactorCode("");
      setPayNotice(null);
      void queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
      void queryClient.invalidateQueries({ queryKey: RECENT_BILLS_KEY });
      setResult(paid);
    } catch (err) {
      if (isTwoFactorRequired(err)) {
        // Codes are single-use: a refused one is cleared, not resubmitted.
        setNeeds2fa(true);
        setTwoFactorCode("");
        setPayNotice({
          title: sentCode ? "Code not accepted" : "Two-factor required",
          body: twoFactorMessage(!!sentCode),
        });
      } else {
        setPayNotice({
          title: "Payment failed",
          body: friendlyErrorMessage(err, "Something went wrong. Your balance was not affected."),
        });
      }
    }
  };

  const payAnother = () => {
    setResult(null);
    setProduct(null);
    setIdentifier(null);
    setValidation(null);
    setAmount("");
  };

  const reviewRows = useMemo<ReviewRow[]>(() => {
    if (!quote || !category) return [];
    const rows: ReviewRow[] = [
      ["Service", info.title],
      [info.provider, category.name],
      [info.identifier, value.trim()],
    ];
    if (validation?.customerName) rows.push(["Name", validation.customerName]);
    if (product) rows.push(["Plan", product.name]);
    rows.push(["Amount", naira(quote.amount)]);
    rows.push(["Fee", quote.fee > 0 ? naira(quote.fee) : "Free"]);
    rows.push(["Total", naira(quote.totalDebited)]);
    return rows;
  }, [quote, category, info, value, validation, product]);

  if (result) return <BillResult bill={result} onDone={payAnother} />;

  return (
    <div className="mx-auto max-w-2xl">
      <Header balance={balances ? balance : undefined} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BILL_TYPES.map((t) => (
          <TypeTile key={t} type={t} selected={t === type} onClick={() => pickType(t)} />
        ))}
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void review();
        }}
      >
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{info.provider}</p>
            {categories.isLoading ? (
              <Loading />
            ) : categories.error ? (
              <p className="text-sm text-danger">{friendlyErrorMessage(categories.error, "Could not load providers.")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(categories.data ?? []).map((c) => (
                  <Pill key={c.id} label={c.name} selected={c.id === category?.id} onClick={() => pickCategory(c)} />
                ))}
              </div>
            )}
          </div>

          <Input
            label={info.identifier}
            placeholder={info.identifierPlaceholder}
            inputMode={isPhoneBill(type) ? "tel" : "numeric"}
            value={value}
            onChange={(e) => changeIdentifier(e.target.value)}
            error={idError}
            hint={
              isPhoneBill(type) && identifier === null && ownPhone
                ? "Your own number is filled in. Change it to buy for someone else."
                : undefined
            }
          />
          {recents.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">Recently used</p>
              <div className="flex flex-wrap gap-2">
                {recents.map((r) => (
                  <Pill
                    key={`${r.categoryId}:${r.customerIdentifier}`}
                    label={recentLabel(r)}
                    selected={
                      value.replace(/\s/g, "") === r.customerIdentifier && (!category || category.id === r.categoryId)
                    }
                    onClick={() => pickRecent(r)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {needsValidation(type) ? (
            validation ? (
              <div className="flex flex-col gap-1 rounded-xl border border-border bg-wash p-4">
                <p className="text-sm text-muted">Paying for</p>
                <p className="text-lg font-semibold">{validation.customerName ?? validation.customerIdentifier}</p>
                {validation.vendType ? <p className="text-sm text-muted">{titleCase(validation.vendType)} meter</p> : null}
                {validation.address ? <p className="text-sm text-muted">{validation.address}</p> : null}
                {validation.outstanding ? (
                  <p className="text-sm text-warning">Outstanding on this meter: {naira(validation.outstanding)}</p>
                ) : null}
              </div>
            ) : (
              <Button variant="secondary" loading={checking} onClick={() => void check()}>
                Check number
              </Button>
            )
          ) : null}
        </Card>

        {hasPlans(type) && category ? (
          <Card className="flex flex-col gap-2">
            <p className="text-sm font-medium">Plan</p>
            {products.isLoading ? (
              <Loading label="Loading plans" />
            ) : products.error ? (
              <p className="text-sm text-danger">{friendlyErrorMessage(products.error, "Could not load plans.")}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {(products.data ?? []).map((p) => {
                  const active = p.code === product?.code;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => setProduct(p)}
                      aria-pressed={active}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        active ? "border-primary bg-wash" : "border-border hover:border-primary"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{p.name}</span>
                        {p.validity ? <span className="block text-sm text-muted">{p.validity}</span> : null}
                      </span>
                      <span className="shrink-0 font-semibold tabular">{p.amount ? naira(p.amount) : "Any amount"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        ) : null}

        {showAmount ? (
          <Card className="flex flex-col gap-3">
            <Input
              label="Amount (₦)"
              placeholder="1000"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
            />
            {QUICK_AMOUNTS[type] ? (
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS[type]!.map((n) => (
                  <Pill key={n} label={naira(n)} selected={amount === String(n)} onClick={() => setAmount(String(n))} />
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}

        {payNotice && (
          <Alert tone={needs2fa && payNotice.title !== "Payment failed" ? "info" : "danger"}>
            <p className="font-semibold">{payNotice.title}</p>
            <p>{payNotice.body}</p>
          </Alert>
        )}

        {needs2fa ? (
          <CodeInput label="Authenticator code" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} />
        ) : null}

        {formError ? <Alert>{formError}</Alert> : null}
        <Button type="submit" block loading={quoting || checking}>
          {needsValidation(type) && !validation ? "Check number" : "Review payment"}
        </Button>
      </form>

      <ReviewSheet
        visible={!!quote}
        title={`Pay ${naira(quote?.totalDebited ?? 0)}`}
        rows={reviewRows}
        note="Paid from your naira balance. Most bills are delivered within a minute."
        confirmLabel="Pay now"
        onConfirm={pay}
        onClose={() => setQuote(null)}
      />
    </div>
  );
}

/** "0803 123 4567 · MTN", or "ADA OBI …5678 · IKEDC" for a meter with a known holder. */
const recentLabel = (r: RecentBill): string => {
  const id = r.customerIdentifier;
  const who = r.customerName
    ? `${r.customerName.split(/\s+/).slice(0, 2).join(" ")} …${id.slice(-4)}`
    : /^0\d{10}$/.test(id)
      ? `${id.slice(0, 4)} ${id.slice(4, 7)} ${id.slice(7)}`
      : id;
  const biller = r.billerName ? (/\(([^)]+)\)\s*$/.exec(r.billerName)?.[1] ?? r.billerName) : null;
  return biller ? `${who} · ${biller}` : who;
};

const STATUS_COPY: Record<BillPayment["status"], { title: string; body: string }> = {
  COMPLETED: { title: "Payment successful", body: "The biller has confirmed it." },
  PROCESSING: {
    title: "Payment processing",
    body: "The biller is still confirming. It usually takes a minute, and you will see it in your history.",
  },
  FAILED: {
    title: "Payment failed",
    body: "The biller refused it, and the money is back in your balance.",
  },
  REVERSED: {
    title: "Payment reversed",
    body: "The money is back in your balance.",
  },
};

function BillResult({ bill, onDone }: { bill: BillPayment; onDone: () => void }) {
  const toast = useToast();
  const copy = STATUS_COPY[bill.status];
  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast("Copied");
    } catch {
      toast("Could not copy. Select the text and copy it instead.", "danger");
    }
  };
  return (
    <div className="mx-auto max-w-xl">
      <Header />
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2 border-primary">
          <p className={`font-display text-xl font-semibold ${bill.status === "COMPLETED" ? "text-success" : ""}`}>{copy.title}</p>
          <p className="text-muted">{bill.failureReason ?? copy.body}</p>
          <p className="font-display text-3xl font-bold tabular">{naira(Number(bill.totalDebited))}</p>
          <p className="text-sm text-muted">
            {[bill.billerName, bill.productName, bill.customerName ?? bill.customerIdentifier].filter(Boolean).join(" · ")}
          </p>
        </Card>
        {bill.token ? (
          <Card className="flex flex-col gap-3">
            <p className="text-sm font-medium">Electricity token</p>
            <p className="select-all break-all font-mono text-2xl font-semibold tracking-wider">{bill.token}</p>
            <Button variant="secondary" onClick={() => void copyToken(bill.token!)}>
              Copy token
            </Button>
          </Card>
        ) : null}
        <Button block onClick={onDone}>
          Pay another bill
        </Button>
      </div>
    </div>
  );
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const PLANNED = [
  {
    title: "Pay from your balance",
    body: "Use your naira balance, and see the total, fee included, before you confirm.",
  },
  {
    title: "Electricity tokens in the app",
    body: "Your token appears as soon as the biller issues it, ready to copy.",
  },
];

/** What the 'bills' switch shows while it is COMING_SOON. */
function BillsComingSoon() {
  return (
    <div className="mx-auto max-w-2xl">
      <Header />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BILL_TYPES.map((t) => (
          <TypeTile key={t} type={t} soon />
        ))}
      </div>
      <Card className="border-primary">
        <p className="font-semibold">Not available yet</p>
        <p className="mt-1 text-muted">
          Bill payments will appear here as soon as they&apos;re ready. There&apos;s nothing to sign up for in the meantime.
        </p>
      </Card>
      <h2 className="mb-2 mt-8 px-1 text-sm font-semibold uppercase tracking-wider text-muted">What it will do</h2>
      <div className="flex flex-col gap-3">
        {PLANNED.map((item) => (
          <Card key={item.title}>
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-sm text-muted">{item.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
