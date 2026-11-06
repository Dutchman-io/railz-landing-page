// Idempotency for money-moving calls.
//
// The server treats a call's `reference` as its idempotency key: send the same
// value again and it returns the original result instead of moving money a
// second time. That only works if the key belongs to the user's ACTION -- one
// amount to one destination -- rather than to a single HTTP request. So a
// reference is minted once, reused for every retry of that action (a second
// tap, a retry after an error or a timeout, a resubmit with a 2FA code), and
// replaced only when the action succeeds or its inputs change.
import { useCallback, useRef } from 'react';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous 0/O/1/I

/**
 * A fresh reference, e.g. `send_lq3k9a_7KD2...`.
 *
 * Letters, digits and underscore only, well under 120 characters: the server
 * accepts `^[A-Za-z0-9._-]+$` up to 120 and may hand the value to a payment
 * rail verbatim. Keep `prefix` to that charset too.
 */
export function generateIdempotencyKey(prefix = 'idem'): string {
  const ts = Date.now().toString(36);
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return `${prefix}_${ts}_${rand}`;
}

export interface ActionReference {
  /**
   * The reference for the action described by `fingerprint` (anything that
   * identifies it: amount, asset, destination...). The same fingerprint gets
   * the same reference until `settle()`; a different one gets a new reference.
   */
  referenceFor: (fingerprint: string) => string;
  /** Forget the held reference. Call once the action has succeeded. */
  settle: () => void;
}

/**
 * Hold one idempotency reference per user action.
 *
 * Kept in a ref, and minted from the submit handler rather than during render,
 * so a re-render can never change it mid-attempt.
 */
export function useActionReference(prefix: string): ActionReference {
  const held = useRef<{ fingerprint: string; reference: string } | null>(
    null,
  );
  const referenceFor = useCallback(
    (fingerprint: string) => {
      if (held.current?.fingerprint !== fingerprint) {
        held.current = {
          fingerprint,
          reference: generateIdempotencyKey(prefix),
        };
      }
      return held.current.reference;
    },
    [prefix],
  );
  const settle = useCallback(() => {
    held.current = null;
  }, []);
  return { referenceFor, settle };
}
