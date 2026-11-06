import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * GET /user/referral: the user's own code to share, made on first ask. Only
 * the code -- whether anyone used it is never shown to the person inviting.
 */
export interface MyReferral {
  code: string;
}

export const REFERRAL_KEY = ["referral"] as const;

/** The server's code for a sign-up code that names no active code. */
export const REFERRAL_CODE_INVALID = "REFERRAL_CODE_INVALID";

export function useMyReferral() {
  return useQuery({
    queryKey: REFERRAL_KEY,
    queryFn: async () =>
      (await api.get<{ data: MyReferral }>("/user/referral")).data,
    staleTime: 5 * 60_000,
  });
}

/** As the server stores it: no spaces or dashes, uppercase. */
export const normalizeReferralCode = (input: string): string =>
  input.replace(/[\s-]/g, "").toUpperCase();

/** What is shared: the code, and where to get the app. */
export const referralMessage = (code: string): string =>
  `Join me on ZemFi. Use my referral code ${code} when you sign up: https://zemfi.ng`;
