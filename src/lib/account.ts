// Account closure. Backed by DELETE /user/delete — the same endpoint the public
// /delete-account page describes, so the two can never drift apart.
import { api } from "./api";

/**
 * Close the signed-in account.
 *
 * The server refuses while a balance is still held or a transfer is in flight,
 * and names which in the error message. Show that message rather than a generic
 * failure: it tells the user the one thing they have to do first.
 *
 * Re-authenticated: a wrong password is a 400 "Incorrect password.", and a
 * missing or wrong code is the 403 TWO_FACTOR_REQUIRED (see stepUpPrompt).
 *
 * Not retried — a user-driven write, and repeating it after a timeout would
 * only report "already deleted".
 */
export async function deleteAccount(input: {
  password: string;
  /** Authenticator code with 2FA on, otherwise the emailed code. */
  twoFactorCode?: string;
}): Promise<void> {
  await api.delete("/user/delete", { body: input, retry: false });
}
