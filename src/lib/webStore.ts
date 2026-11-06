/**
 * The subset of expo-secure-store the libs shared with zemfi-mobile use, over
 * localStorage. The browser has no keychain: tokens here are as safe as the
 * page is free of injected script, which is the same trade the admin console
 * makes. Every accessor tolerates storage being unavailable (private mode,
 * blocked site data, server render).
 */
const store = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const getItem = (key: string): string | null => {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const setItem = (key: string, value: string): void => {
  try {
    store()?.setItem(key, value);
  } catch {
    // Storage full or blocked: nothing to persist to.
  }
};

export const getItemAsync = async (key: string): Promise<string | null> =>
  getItem(key);

export const setItemAsync = async (key: string, value: string): Promise<void> =>
  setItem(key, value);

export const deleteItemAsync = async (key: string): Promise<void> => {
  try {
    store()?.removeItem(key);
  } catch {
    // Nothing to remove.
  }
};
