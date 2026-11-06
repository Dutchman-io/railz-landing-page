import { useQuery } from "@tanstack/react-query";
import * as SecureStore from './webStore';
import { api } from "./api";
import {
  allCurrencies,
  setCurrencyCatalogue,
  type CurrencyMeta,
} from "./currency";

/**
 * The currency catalogue, served by the backend.
 *
 * The app used to hold this itself — a symbol map, a name map and a stablecoin
 * list — so a new currency meant a frontend edit and an app-store release
 * before anyone could see it. It is fetched now, and the app holds no currency
 * list at all.
 *
 * Cached to storage because the formatting helpers are synchronous and used
 * during the first paint: a returning user should not see an amount rendered
 * without its symbol while the fetch is in flight.
 */
const CACHE_KEY = "currency-catalogue";

export const CURRENCIES_KEY = ["currencies"] as const;

export type { CurrencyMeta };

/** Load the last known catalogue so the first render already has one. */
export function hydrateCurrencyCatalogue(): void {
  try {
    const raw = SecureStore.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) setCurrencyCatalogue(parsed as CurrencyMeta[]);
  } catch {
    // A missing or unreadable cache just means the first paint falls back to
    // rendering the code, which the fetch corrects a moment later.
  }
}

export async function fetchCurrencies(): Promise<CurrencyMeta[]> {
  const res = await api.get<{ data?: CurrencyMeta[] }>("/currencies");
  const list = Array.isArray(res.data) ? res.data : [];
  if (list.length > 0) {
    setCurrencyCatalogue(list);
    void SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(list));
  }
  return list;
}

export function useCurrencies() {
  return useQuery({
    queryKey: CURRENCIES_KEY,
    queryFn: fetchCurrencies,
    /**
     * Fifteen minutes, not a day.
     *
     * A day sounds right for something that changes as rarely as this, but it
     * quietly opted the catalogue out of the only refresh the app has:
     * _layout bridges AppState into react-query's focusManager, which
     * refetches queries that are STALE when the app comes back to the
     * foreground. Nothing here was ever stale, so a phone that keeps the app
     * in memory for days kept the catalogue it launched with -- which is how
     * six currencies could be added to the backend and stay invisible.
     *
     * The cost of being wrong the other way is one small request per
     * foreground, against a list rendered instantly from the storage cache
     * either way.
     */
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * The catalogue as a value a screen can build a list from.
 *
 * `allCurrencies()` reads a module-level map that this fetch replaces, so a
 * `useMemo` over it silently keeps whatever was there at mount -- which is how
 * a currency added on the backend could stay invisible until the app was
 * restarted. Returning the list means the memo depends on something React can
 * actually see change. Falls back to the map for the first paint, before the
 * fetch resolves, where the map holds the storage-cached or seeded list.
 */
export function useCurrencyCatalogue(): CurrencyMeta[] {
  const { data } = useCurrencies();
  return data?.length ? data : allCurrencies();
}
