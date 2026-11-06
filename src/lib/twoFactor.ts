// Two-factor (TOTP) auth. Setup returns an otpauth:// URL (rendered as a QR) and
// the raw secret for manual entry; enable/disable confirm with a 6-digit code.
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { ApiError } from './api';

export const TWO_FACTOR_KEY = ['two-factor-status'] as const;

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
}

export function useTwoFactorStatus() {
  return useQuery({
    queryKey: TWO_FACTOR_KEY,
    queryFn: async () => {
      const res = await api.get<{ data: { enabled: boolean } }>(
        '/authentication/2fa/status',
      );
      return res.data.enabled;
    },
  });
}

export async function setupTwoFactor(): Promise<TwoFactorSetup> {
  const res = await api.post<{ data: TwoFactorSetup }>(
    '/authentication/2fa/setup',
    {},
    { retry: false },
  );
  return res.data;
}

export async function enableTwoFactor(token: string): Promise<void> {
  await api.post('/authentication/2fa/enable', { token }, { retry: false });
}

export async function disableTwoFactor(token: string): Promise<void> {
  await api.post('/authentication/2fa/disable', { token }, { retry: false });
}

// A 403 with this code means the action needs a fresh authenticator code.
export function isTwoFactorRequired(err: unknown): boolean {
  const e = err as ApiError;
  if (e?.status !== 403) return false;
  const code = (e.data as { code?: string } | undefined)?.code;
  return code === 'TWO_FACTOR_REQUIRED' || /two-factor/i.test(e.message ?? '');
}

/** First ask: no code has been sent for this action yet. */
export const TWO_FACTOR_PROMPT =
  'Enter the 6-digit code from your authenticator app to confirm.';

/**
 * A code WAS sent and refused. Each code works once (per 30-second window),
 * so the usual cause is a code already spent -- on a previous attempt or a
 * double tap -- or one that rolled over while the user was typing.
 */
export const TWO_FACTOR_RETRY_MESSAGE =
  'That code was already used or has expired. Enter the next code from your authenticator.';

/** What to tell the user after a TWO_FACTOR_REQUIRED refusal. */
export const twoFactorMessage = (codeWasSent: boolean): string =>
  codeWasSent ? TWO_FACTOR_RETRY_MESSAGE : TWO_FACTOR_PROMPT;
