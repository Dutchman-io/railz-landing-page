// Two-factor (TOTP) auth. Setup returns an otpauth:// URL (rendered as a QR) and
// the raw secret for manual entry; enable/disable confirm with a 6-digit code.
import { useQuery } from '@tanstack/react-query';
import { api, friendlyErrorMessage } from './api';
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

// A 403 with one of these codes means the action needs a fresh code: from the
// authenticator app (TWO_FACTOR_REQUIRED), or -- on the web, for a user
// without one -- the code we just emailed (EMAIL_OTP_REQUIRED). Both are
// answered the same way: ask for the code and repeat the request with it.
export function isTwoFactorRequired(err: unknown): boolean {
  const e = err as ApiError;
  if (e?.status !== 403) return false;
  const code = (e.data as { code?: string } | undefined)?.code;
  return (
    code === 'TWO_FACTOR_REQUIRED' ||
    code === 'EMAIL_OTP_REQUIRED' ||
    /two-factor/i.test(e.message ?? '')
  );
}

/** The code comes from email (no authenticator app), not from an app:
 * EMAIL_OTP_REQUIRED, or TWO_FACTOR_REQUIRED with details.method 'email'. */
export function isEmailCode(err: unknown): boolean {
  const data = (err as ApiError)?.data as
    | { code?: string; details?: { method?: unknown } }
    | undefined;
  return data?.code === 'EMAIL_OTP_REQUIRED' || data?.details?.method === 'email';
}

/** Email a one-time code to a user without 2FA. */
export async function requestEmailCode(): Promise<void> {
  await api.post('/authentication/2fa/email-code', {}, { retry: false });
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

/**
 * What to tell the user after the refusal. For an emailed code the server's
 * own sentence says what happened (sent, wrong, expired, a new one sent).
 */
export const twoFactorMessage = (codeWasSent: boolean, err?: unknown): string =>
  isEmailCode(err) && (err as ApiError).message
    ? (err as ApiError).message
    : codeWasSent
      ? TWO_FACTOR_RETRY_MESSAGE
      : TWO_FACTOR_PROMPT;

/**
 * What to show after a TWO_FACTOR_REQUIRED refusal. When it asks for an
 * emailed code (details.method 'email') the code is requested here first --
 * a fresh one after a refused code too, since the old one may be spent --
 * and the same code field takes it. Never throws: a failed send is a
 * message too.
 */
export async function stepUpPrompt(
  err: unknown,
  codeWasSent: boolean,
): Promise<{ title: string; message: string }> {
  const method = ((err as ApiError)?.data as { details?: { method?: unknown } } | undefined)
    ?.details?.method;
  if (method !== 'email') {
    return {
      title: codeWasSent ? 'Code not accepted' : isEmailCode(err) ? 'Check your email' : 'Two-factor required',
      message: twoFactorMessage(codeWasSent, err),
    };
  }
  try {
    await requestEmailCode();
  } catch (sendErr) {
    return {
      title: 'Could not send a code',
      message: friendlyErrorMessage(sendErr, 'Please try again shortly.'),
    };
  }
  return {
    title: codeWasSent ? 'Code not accepted' : 'Check your email',
    message: codeWasSent
      ? "That code didn't work, so we emailed you a new one. Enter it to confirm."
      : 'We emailed you a code. Enter it to confirm.',
  };
}
