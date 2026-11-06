"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Loading } from "@/components/ui/Spinner";
import { PromptModal, type PromptSpec } from "@/components/send/PromptModal";
import { friendlyErrorMessage } from "@/lib/api";
import {
  ACCOUNTS_KEY,
  deleteBankAccount,
  setDefaultBankAccount,
  useAccounts,
  useBanks,
  type SavedBankAccount,
} from "@/lib/banks";
import { useFiatForCountry } from "@/lib/countries";
import { currencyName, isStablecoin } from "@/lib/currency";
import { useBalances } from "@/lib/wallet";
import { useAuth } from "@/state/auth";
import { AddAccountForm } from "./AddAccountForm";

// The user's local payout fiat: their country's currency, else the fiat
// balance they hold (which the backend also keys off their country). Null when
// neither is known yet -- copy then stays neutral rather than assuming one.
const useFiatCurrency = (): string | null => {
  const { user } = useAuth();
  const fromCountry = useFiatForCountry(user?.country);
  const { data: balances } = useBalances();
  return fromCountry ?? balances?.find((b) => !isStablecoin(b.currency))?.currency ?? null;
};

// NUBANs are 10 digits; show only the last 4 so the list is scannable without
// exposing the full number.
export const maskAccount = (n: string) => `••••${n.slice(-4)}`;

export function BankRegistryScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Names for the saved accounts' bank codes, from the user's own country's
  // directory (the server's default when the country is not known).
  const { data: banks = [] } = useBanks(user?.country ?? undefined);
  const { data: accounts = [], isLoading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAccounts();
  const fiatCurrency = useFiatCurrency();
  // 'list' shows saved accounts; 'add' shows the link-a-new-account form.
  const [mode, setMode] = useState<"list" | "add">("list");
  // The account whose default/remove action is in flight — disables its row.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptSpec | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);

  const bankName = (code: string) => banks.find((b) => b.code === code)?.name ?? code;
  const invalidateAccounts = () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });

  const onMakeDefault = async (account: SavedBankAccount) => {
    if (pendingId) return;
    setPendingId(account.id);
    setActionError(null);
    try {
      await setDefaultBankAccount(account.id);
      await invalidateAccounts();
    } catch (err) {
      setActionError({
        title: "Could not update default",
        message: friendlyErrorMessage(err, "Something went wrong. Please try again."),
      });
    } finally {
      setPendingId(null);
    }
  };

  const onRemove = (account: SavedBankAccount) =>
    setPrompt({
      title: "Remove bank account",
      message: `Remove ${bankName(account.bankCode)} ${maskAccount(account.accountNumber)}?`,
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setPendingId(account.id);
            setActionError(null);
            try {
              await deleteBankAccount(account.id);
              await invalidateAccounts();
            } catch (err) {
              setActionError({
                title: "Could not remove account",
                message: friendlyErrorMessage(err, "Something went wrong. Please try again."),
              });
            } finally {
              setPendingId(null);
            }
          },
        },
      ],
    });

  if (mode === "add") {
    return (
      <AddAccountForm
        onCancel={() => setMode("list")}
        // Only allow cancelling back to the list when there is a list to go
        // back to; the first-ever account has nothing behind it.
        canCancel={accounts.length > 0}
        onSaved={(saved) => {
          // Show the new account immediately so the list is never briefly
          // empty while the refetch is in flight, then invalidate to reconcile
          // with the server (which also settles the default flag).
          queryClient.setQueryData<SavedBankAccount[]>(ACCOUNTS_KEY, (prev) => {
            const rest = (prev ?? []).filter((a) => a.id !== saved.id);
            return saved.isDefault ? [saved, ...rest.map((a) => ({ ...a, isDefault: false }))] : [...rest, saved];
          });
          void invalidateAccounts();
          setMode("list");
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader
        title="Payout bank accounts"
        subtitle={
          fiatCurrency
            ? `${currencyName(fiatCurrency)} from your USDT sales is sent to your default payout account.`
            : "Proceeds from your USDT sales are sent to your default payout account."
        }
      />

      {actionError && (
        <Alert tone="danger">
          <strong className="block">{actionError.title}</strong>
          {actionError.message}
        </Alert>
      )}

      {accountsLoading ? (
        <Loading />
      ) : accountsError ? (
        // A failed load must not masquerade as "no accounts" — surface the real
        // error and let the user retry.
        <Card className="flex flex-col gap-3">
          <p className="font-semibold">Couldn’t load your accounts</p>
          <p className="text-sm text-muted">
            {friendlyErrorMessage(accountsError, "Something went wrong. Please try again.")}
          </p>
          <Button onClick={() => void refetchAccounts()}>Try again</Button>
        </Card>
      ) : accounts.length === 0 ? (
        <Card className="flex flex-col gap-3">
          <p className="font-semibold">No payout account yet</p>
          <p className="text-sm text-muted">Add a bank account in your name to receive your payouts.</p>
          <Button onClick={() => setMode("add")}>Add bank account</Button>
        </Card>
      ) : (
        <>
          {accounts.map((account) => {
            const busy = pendingId === account.id;
            return (
              <Card key={account.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{bankName(account.bankCode)}</p>
                  {account.isDefault && (
                    <span className="rounded-full bg-wash px-2.5 py-0.5 text-xs font-semibold tracking-wider text-primary">
                      DEFAULT
                    </span>
                  )}
                </div>
                <p className="font-mono text-sm text-muted tabular">
                  {maskAccount(account.accountNumber)} · {account.currency}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  {account.isDefault ? (
                    <span className="text-sm text-muted">Default payout account</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onMakeDefault(account)}
                      disabled={busy}
                      className="text-sm font-medium text-primary disabled:opacity-50"
                    >
                      {busy ? "Working…" : "Make default"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(account)}
                    disabled={busy}
                    className="text-sm font-medium text-danger disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </Card>
            );
          })}
          <Button variant="secondary" onClick={() => setMode("add")}>
            Add another account
          </Button>
        </>
      )}
      <PromptModal prompt={prompt} onClose={() => setPrompt(null)} />
    </div>
  );
}
