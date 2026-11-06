import * as SecureStore from './webStore';
import { AuthUser } from '@/types/api';

// Tokens & session keys live in the platform Keychain/Keystore per PRD §6
// "Local Cryptographic State Security".
const ACCESS_TOKEN_KEY = 'db.accessToken';
const REFRESH_TOKEN_KEY = 'db.refreshToken';
// The last profile /user/me returned. Not a credential — it is what the app
// renders from when it cannot reach the server on a cold start, so that being
// offline no longer costs the user their session. See state/auth.tsx.
const USER_KEY = 'db.user';

export const secureStorage = {
  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  },
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },
  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async setUser(user: AuthUser): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch {
      // A cache that cannot be written is not worth failing a sign-in over.
    }
  },
  async getUser(): Promise<AuthUser | null> {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      // Unreadable or written by an older shape of AuthUser.
      return null;
    }
  },
  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },
};
