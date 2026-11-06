// Name-match control (PRD SCR-004): a user may only add a bank account that is
// in THEIR OWN name. We compare the bank-resolved account holder name against
// the user's verified identity.
//
// Bank names are messy — order varies (surname-first vs. first-first), middle
// names appear or don't, and casing/punctuation/diacritics are inconsistent.
// So we tokenize both sides and require that every token of the user's verified
// name is present in the bank name (order-independent, extra middle names OK).
//
// IMPORTANT: this is a client-side UX gate only. The authoritative check MUST be
// re-run server-side when the account is saved — never trust the client for a
// fraud/compliance control. Keep this logic in sync with the backend.

// Lowercase alphabetic tokens: strip diacritics, drop punctuation/digits,
// collapse whitespace. "Àdá O'Brien-Lovelace" -> ["ada", "o", "brien", "lovelace"]
function tokenize(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ') // punctuation, hyphens, apostrophes, digits -> space
    .split(/\s+/)
    .filter(Boolean);
}

export type NameMatchResult =
  | { status: 'match' }
  | { status: 'mismatch' }
  | { status: 'unknown' }; // not enough info to decide (missing name on either side)

export function matchAccountName(
  bankAccountName: string | undefined | null,
  firstName: string | undefined | null,
  lastName: string | undefined | null,
): NameMatchResult {
  const bankTokens = new Set(tokenize(bankAccountName ?? ''));
  const required = [...tokenize(firstName ?? ''), ...tokenize(lastName ?? '')];

  if (bankTokens.size === 0 || required.length === 0) {
    return { status: 'unknown' };
  }

  const allPresent = required.every((token) => bankTokens.has(token));
  return { status: allPresent ? 'match' : 'mismatch' };
}
