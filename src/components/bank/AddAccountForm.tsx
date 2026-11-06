"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { Segment } from "@/components/send/Segment";
import { friendlyErrorMessage } from "@/lib/api";
import { addBankAccount, useBanks, useResolvedAccount, type SavedBankAccount } from "@/lib/banks";
import { useCountries } from "@/lib/countries";
import { countryDisplayName } from "@/lib/countryDisplay";
import { currencyName } from "@/lib/currency";
import { useCorridors } from "@/lib/globalSend";
import { matchAccountName } from "@/lib/nameMatch";
import { useAuth } from "@/state/auth";
import type { Bank } from "@/types/api";

const SEARCH_MIN = 3; // start filtering once the user has typed 3 characters
const MAX_RESULTS = 8; // cap the visible matches so the list stays scannable

const RAILS = [
  { value: "ACH", label: "ACH Direct Deposit" },
  { value: "WIRE", label: "Wire Transfer" },
] as const;

interface PayoutCountry {
  code: string;
  name: string;
  currency: string;
}

/**
 * Every country an account can be linked for — onboarding countries (a local
 * withdrawal account) plus global-send corridors (a cross-border
 * beneficiary). Both come from the server; this just merges and dedupes them.
 */
function usePayoutCountries(): PayoutCountry[] {
  const { data: onboarding = [] } = useCountries();
  const { data: corridors = [] } = useCorridors();
  return useMemo(() => {
    const byCode = new Map<string, PayoutCountry>();
    for (const c of onboarding) {
      byCode.set(c.code, { code: c.code, name: countryDisplayName(c.code), currency: c.currency });
    }
    for (const c of corridors) {
      byCode.set(c.country, { code: c.country, name: countryDisplayName(c.country), currency: c.currency });
    }
    return [...byCode.values()];
  }, [onboarding, corridors]);
}

const digits = (value: string) => value.replace(/\D/g, "");

/** The link-a-new-account form: destination country, the bank and account,
 * and (NGN) a name check against the user's verified identity. */
export function AddAccountForm({
  onSaved,
  onCancel,
  canCancel,
}: {
  onSaved: (saved: SavedBankAccount) => void;
  onCancel: () => void;
  canCancel: boolean;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const payoutCountries = usePayoutCountries();
  // Until they pick, default to their own onboarding country when it is a
  // payout country. When it is unknown or unsupported nothing is selected and
  // the user chooses -- never assume one. Derived, not set from an effect.
  const [pickedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const home = user?.country?.toUpperCase() ?? null;
  const selectedCountryCode =
    pickedCountryCode ?? (home && payoutCountries.some((c) => c.code === home) ? home : null);
  const selectedCountry = useMemo<PayoutCountry | null>(
    () => payoutCountries.find((c) => c.code === selectedCountryCode) ?? null,
    [selectedCountryCode, payoutCountries],
  );
  const fiatCurrency = selectedCountry?.currency ?? null;
  const isChina = selectedCountry?.code === "CN";
  const { data: banks = [], isLoading: banksLoading } = useBanks(selectedCountry?.code ?? null);
  // NGN payouts resolve the account name (NUBAN name-enquiry) and must match
  // the user's identity. Other currencies don't offer that instant check, so
  // the account is validated by the payout provider at settlement.
  const isNgn = fiatCurrency === "NGN";
  const minAccountLen = isNgn ? 10 : 6;

  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [query, setQuery] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState(""); // US ACH / Wire routing number
  const [sortCode, setSortCode] = useState(""); // UK 6-digit sort code
  const [transitNumber, setTransitNumber] = useState(""); // CA 5-digit transit
  const [institutionNumber, setInstitutionNumber] = useState(""); // CA 3-digit institution
  const [usPaymentRail, setUsPaymentRail] = useState<"ACH" | "WIRE">("ACH");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset selected bank and search query when destination country changes.
  const onSelectCountry = (countryCode: string) => {
    setSelectedCountryCode(countryCode);
    setSelectedBank(null);
    setQuery("");
    setAccountNumber("");
    setRoutingNumber("");
    setSortCode("");
    setTransitNumber("");
    setInstitutionNumber("");
    setBeneficiaryName("");
  };

  // Client-side filter over the cached directory — instant, no per-keystroke
  // network calls. Only shown once a bank isn't already chosen.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < SEARCH_MIN) return [];
    return banks.filter((b) => b.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
  }, [banks, query]);

  // Name-enquiry only applies to NGN — pass no bank code otherwise so the hook
  // stays disabled.
  const {
    data: resolvedName,
    isFetching: resolving,
    error: resolveError,
  } = useResolvedAccount(isNgn ? selectedBank?.code : undefined, accountNumber);

  // The resolved account holder must be the same person adding it — only
  // allow saving an account in the user's own verified name.
  const nameCheck = resolvedName ? matchAccountName(resolvedName, user?.firstName, user?.lastName) : null;

  const isUs = selectedCountry?.code === "US";
  const isUk = selectedCountry?.code === "GB";
  const isCa = selectedCountry?.code === "CA";

  const canSave = (() => {
    if (saving || !selectedCountry) return false;
    if (isNgn) {
      return !!selectedBank && accountNumber.length === 10 && !!resolvedName && nameCheck?.status === "match";
    }
    if (isChina) return accountNumber.length >= 6;
    if (isUs) {
      return accountNumber.length >= 4 && routingNumber.length === 9 && beneficiaryName.trim().length > 0;
    }
    if (isUk) {
      return accountNumber.length === 8 && digits(sortCode).length === 6 && beneficiaryName.trim().length > 0;
    }
    if (isCa) {
      return (
        accountNumber.length >= 6 &&
        transitNumber.length === 5 &&
        institutionNumber.length === 3 &&
        beneficiaryName.trim().length > 0
      );
    }
    return !!selectedBank || accountNumber.length >= minAccountLen;
  })();

  const onSave = async () => {
    if (!canSave || saving || !selectedCountry || !fiatCurrency) return;
    setSaving(true);
    setSaveError(null);
    try {
      const bankCode = isUs
        ? `US_${usPaymentRail}_${routingNumber}`
        : isUk
          ? `UK_FPS_${digits(sortCode)}`
          : isCa
            ? `CA_EFT_${institutionNumber}_${transitNumber}`
            : isChina
              ? "STABLES_CN"
              : (selectedBank?.code ?? "DEFAULT");
      const saved = await addBankAccount({ accountNumber, bankCode, currency: fiatCurrency });
      toast(`Bank account saved. Your ${selectedCountry.name} payout account is linked.`);
      onSaved(saved);
    } catch (err) {
      setSaveError(friendlyErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  // Number-pad fields on mobile: digits only here.
  const numeric = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(digits(e.target.value));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader
        title="Add payout account"
        subtitle={
          fiatCurrency
            ? `Select destination country and enter payout details to receive ${currencyName(fiatCurrency)} when you sell crypto.`
            : "Select the country your bank account is in, then enter its payout details."
        }
      />
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Destination Country</p>
          <div className="flex flex-wrap gap-2">
            {payoutCountries.map((c) => {
              const isSelected = c.code === selectedCountry?.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => onSelectCountry(c.code)}
                  aria-pressed={isSelected}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    isSelected ? "border-primary bg-primary text-on-primary" : "border-border hover:border-primary"
                  }`}
                >
                  {c.name} ({c.currency})
                </button>
              );
            })}
          </div>
          {!selectedCountry && (
            <p className="text-sm text-muted">
              {payoutCountries.length === 0
                ? "Loading payout countries…"
                : "Choose the country your bank account is in."}
            </p>
          )}
        </div>

        {isUs && (
          <>
            <Segment label="Payment Method" options={RAILS} value={usPaymentRail} onChange={setUsPaymentRail} />
            <Input
              label="Beneficiary Full Name"
              placeholder="e.g. John Doe"
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
            />
            <Input
              label="Routing Number (ABA)"
              placeholder="9-digit routing number"
              inputMode="numeric"
              maxLength={9}
              value={routingNumber}
              onChange={numeric(setRoutingNumber)}
            />
            <Input
              label="Account Number"
              placeholder="US Bank Account Number"
              inputMode="numeric"
              value={accountNumber}
              onChange={numeric(setAccountNumber)}
            />
          </>
        )}

        {isUk && (
          <>
            <Input
              label="Beneficiary Full Name"
              placeholder="e.g. Jane Smith"
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
            />
            <Input
              label="Sort Code"
              placeholder="6-digit sort code (e.g. 12-34-56)"
              inputMode="numeric"
              maxLength={8}
              value={sortCode}
              onChange={(e) => setSortCode(e.target.value)}
            />
            <Input
              label="Account Number"
              placeholder="8-digit UK account number"
              inputMode="numeric"
              maxLength={8}
              value={accountNumber}
              onChange={numeric(setAccountNumber)}
            />
          </>
        )}

        {isCa && (
          <>
            <Input
              label="Beneficiary Full Name"
              placeholder="e.g. Robert Tremblay"
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
            />
            <Input
              label="Institution Number"
              placeholder="3-digit institution code (e.g. 004)"
              inputMode="numeric"
              maxLength={3}
              value={institutionNumber}
              onChange={numeric(setInstitutionNumber)}
            />
            <Input
              label="Transit Number"
              placeholder="5-digit branch transit code"
              inputMode="numeric"
              maxLength={5}
              value={transitNumber}
              onChange={numeric(setTransitNumber)}
            />
            <Input
              label="Account Number"
              placeholder="Canadian bank account number"
              inputMode="numeric"
              value={accountNumber}
              onChange={numeric(setAccountNumber)}
            />
          </>
        )}

        {isChina && (
          <>
            <div className="rounded-xl border border-border bg-background px-4 py-3">
              <p className="text-sm font-semibold">China payouts</p>
              <p className="mt-1 text-sm text-muted">
                Payouts to China are reviewed and sent manually, so they can take longer than other payouts. We may
                contact you for extra details.
              </p>
            </div>
            <Input
              label="Alipay ID / WeChat / UnionPay Card"
              placeholder="Enter Alipay phone/email or UnionPay number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </>
        )}

        {/* Default / NGN directory form */}
        {selectedCountry && !isUs && !isUk && !isCa && !isChina && (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">Bank ({selectedCountry.name})</p>
              {selectedBank ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
                  <span className="font-medium">{selectedBank.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBank(null);
                      setQuery("");
                    }}
                    className="text-sm font-medium text-primary"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    label="Search bank"
                    placeholder="Type at least 3 letters"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {banksLoading && (
                    <p className="text-sm text-muted">Loading bank directory for {selectedCountry.name}…</p>
                  )}
                  {!banksLoading && query.trim().length >= SEARCH_MIN && matches.length === 0 && (
                    <p className="text-sm text-muted">No banks match “{query.trim()}”.</p>
                  )}
                  {matches.length > 0 && (
                    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {matches.map((bank) => (
                        <button
                          key={bank.code}
                          type="button"
                          onClick={() => {
                            setSelectedBank(bank);
                            setQuery("");
                          }}
                          className="block w-full px-4 py-3 text-left text-sm hover:bg-wash"
                        >
                          {bank.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <Input
              label="Account number"
              placeholder={isNgn ? "10-digit NUBAN" : "Account number"}
              inputMode="numeric"
              maxLength={isNgn ? 10 : 20}
              value={accountNumber}
              onChange={numeric(setAccountNumber)}
            />
          </>
        )}

        {selectedCountry && !isNgn && selectedBank && accountNumber.length >= minAccountLen && (
          <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
            Payouts to {selectedCountry.name} ({fiatCurrency}) are verified by the settlement provider during
            processing.
          </div>
        )}

        {isNgn && selectedBank && accountNumber.length === 10 && (
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-sm text-muted">Account name</p>
            {resolving ? (
              <Spinner className="mt-2 size-5 text-primary" />
            ) : resolveError ? (
              <p className="mt-1 text-sm text-danger">Couldn’t verify this account. Check the bank and number.</p>
            ) : (
              <>
                <p className="mt-1 font-semibold">{resolvedName}</p>
                {nameCheck?.status === "match" ? (
                  <p className="mt-1 text-sm text-success">✓ Matches your verified identity.</p>
                ) : nameCheck?.status === "mismatch" ? (
                  <p className="mt-1 text-sm text-danger">
                    This account is in a different name. You can only add a bank account in your own verified name.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">Must match your verified identity to save.</p>
                )}
              </>
            )}
          </div>
        )}

        {saveError && (
          <Alert tone="danger">
            <strong className="block">Could not save account</strong>
            {saveError}
          </Alert>
        )}

        <Button block onClick={() => void onSave()} loading={saving} disabled={!canSave}>
          Save bank account
        </Button>
        {canCancel && (
          <Button block variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </Card>
    </div>
  );
}
