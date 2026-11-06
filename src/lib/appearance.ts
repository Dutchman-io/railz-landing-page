// Appearance preference: System (follow the OS), Light, or Dark. Persisted so it
// can be read *synchronously* at launch (expo-secure-store exposes getItem sync),
// which is what lets the theme palette be chosen at module load — see theme/colors.
import * as SecureStore from './webStore';

export type AppearancePref = 'system' | 'light' | 'dark';

const KEY = 'appearance-pref';

export function getStoredAppearance(): AppearancePref {
  try {
    const value = SecureStore.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export async function setStoredAppearance(pref: AppearancePref): Promise<void> {
  if (pref === 'system') {
    await SecureStore.deleteItemAsync(KEY);
  } else {
    await SecureStore.setItemAsync(KEY, pref);
  }
}
