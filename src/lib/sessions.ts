// Signed-in devices (zemfi-backend /authentication/sessions).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface Session {
  id: string;
  device: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export const SESSIONS_KEY = ["sessions"] as const;

export async function fetchSessions(): Promise<Session[]> {
  const res = await api.get<{ data?: { sessions?: Session[] } }>(
    "/authentication/sessions",
  );
  return res.data?.sessions ?? [];
}

export function useSessions() {
  return useQuery({ queryKey: SESSIONS_KEY, queryFn: fetchSessions });
}

export async function revokeSession(id: string): Promise<void> {
  await api.delete(`/authentication/sessions/${encodeURIComponent(id)}`);
}

export async function revokeOtherSessions(): Promise<number> {
  const res = await api.post<{ data?: { revoked?: number } }>(
    "/authentication/sessions/revoke-others",
    undefined,
    { retry: false },
  );
  return res.data?.revoked ?? 0;
}

/** Ends this device's session server-side. Best effort on sign-out. */
export async function logout(refreshToken: string): Promise<void> {
  try {
    await api.post(
      "/authentication/logout",
      { refreshToken },
      { retry: false },
    );
  } catch {
    // Offline or already expired: the local sign-out still happens, and the
    // refresh token dies of old age.
  }
}

export function useInvalidateSessions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
}

/**
 * The app now sends its own name in X-Device-Name, so most rows arrive
 * display-ready ("Ehis's iPhone") and are shown as-is. Only a User-Agent —
 * which always carries a "product/version" token, and is all a browser or an
 * older build of the app gives us — needs unpicking: "ZemFi/15 (iPhone; iOS
 * 19)" → "iPhone".
 */
export const deviceName = (device: string | null): string => {
  if (!device) return "Unknown device";
  if (!device.includes("/")) return device;
  const inParens = /\(([^;)]+)/.exec(device)?.[1]?.trim();
  return inParens || device.split("/")[0] || device;
};
