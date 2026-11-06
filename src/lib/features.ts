import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * Which capabilities are usable right now, as the admin portal has set them.
 *
 * This is presentation only — the server refuses a disabled capability whatever
 * the app does. Reading it lets the app say why up front instead of letting
 * someone fill in a form that was never going to submit.
 */
export type FeatureStatus = "LIVE" | "COMING_SOON" | "OFF";

export type FeatureKey =
  | "onramp"
  | "offramp"
  | "global_send"
  | "crypto_send"
  | "withdrawal"
  | "funding"
  | "receiving"
  | "invoicing"
  | "bills"
  | "tokens";

export interface Feature {
  key: FeatureKey;
  label: string;
  status: FeatureStatus;
  /** Only LIVE may act. COMING_SOON refuses exactly as OFF does. */
  enabled: boolean;
  message: string | null;
}

export const FEATURES_KEY = ["features"] as const;

export async function fetchFeatures(): Promise<Feature[]> {
  const res = await api.get<{ data?: Feature[] }>("/features");
  return Array.isArray(res.data) ? res.data : [];
}

export function useFeatures() {
  return useQuery({
    queryKey: FEATURES_KEY,
    queryFn: fetchFeatures,
    // An operator switching something off mid-session should reach the app
    // without a restart, but this is not worth polling hard for.
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/**
 * What the app should do with a capability.
 *
 * FAILS OPEN. An unknown key, a failed fetch, or a list that has not loaded
 * yet all read as LIVE: hiding a working feature because a status call failed
 * would be a worse outage than the one it was trying to describe, and the
 * server still refuses anything genuinely disabled.
 */
export function featureState(
  features: Feature[] | undefined,
  key: FeatureKey,
): Feature {
  return (
    features?.find((f) => f.key === key) ?? {
      key,
      label: key,
      status: "LIVE",
      enabled: true,
      message: null,
    }
  );
}
