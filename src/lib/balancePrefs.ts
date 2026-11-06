// Dashboard balance-card preferences, persisted so the card opens the same way
// next launch: which currency it shows, and whether the figure is masked.
import * as SecureStore from './webStore';

const CURRENCY_KEY = "balance-currency";
const HIDDEN_KEY = "balance-hidden";

// The user picks one of the balances the API returns (local fiat, USDT, USDC,
// …). Empty = fall back to the local fiat.
export function getStoredBalanceCurrency(): string | null {
  try {
    return SecureStore.getItem(CURRENCY_KEY) || null;
  } catch {
    return null;
  }
}

export async function setStoredBalanceCurrency(
  currency: string,
): Promise<void> {
  await SecureStore.setItemAsync(CURRENCY_KEY, currency);
}

// Masking is for checking the app in public; it hides the amount only, never
// the currency, so the chips still make sense.
export function getStoredBalanceHidden(): boolean {
  try {
    return SecureStore.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

export async function setStoredBalanceHidden(hidden: boolean): Promise<void> {
  if (hidden) {
    await SecureStore.setItemAsync(HIDDEN_KEY, "1");
  } else {
    await SecureStore.deleteItemAsync(HIDDEN_KEY);
  }
}
