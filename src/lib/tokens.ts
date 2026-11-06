// Tokens (BTC, ETH, SOL, BNB, TRX) held in the user's own exchange
// sub-account: deposit, convert to USDT or their fiat, send on-chain. Backed
// by /user/tokens, behind the `tokens` feature switch.
import { useQuery } from "@tanstack/react-query";
import { api, apiErrorCode } from "./api";

export const TOKENS_KEY = ["tokens"] as const;

export interface TokenHolding {
  token: string;
  network: string;
  decimals: number;
  balance: number;
  /** `tag` (XRP) or `memo` (XLM, TON) when deposits need one. */
  memoType?: "tag" | "memo" | null;
  /** False while the token can be held and converted but not sent. */
  sendable?: boolean;
}

export interface TokenAddress {
  token: string;
  network: string;
  address: string;
  /** The tag or memo every deposit must carry; null where none is needed. */
  memo?: string | null;
  memoType?: "tag" | "memo" | null;
}

/** Indicative: no price is held. Amounts are decimal strings. */
export interface TokenConversionQuote {
  token: string;
  amount: string;
  target: string;
  rate: number | null;
  estimatedReceived: string;
  estimatedFee: string;
  estimatedCredited: string;
  feeBps: number;
}

export interface TokenConversion {
  id: string;
  reference: string;
  token: string;
  amount: string;
  target: string;
  /** NEEDS_REVIEW: the result is being checked; never retried. */
  status: string;
  received: string | null;
  fee: string | null;
  credited: string | null;
}

export interface TokenSendQuote {
  token: string;
  network: string;
  amount: string;
  networkFee: string;
  netAmount: string;
  minSendUsdt: number;
  valid: boolean;
}

export interface TokenSend {
  reference: string;
  asset: string;
  network: string;
  amount: number;
  fee: number;
  netAmount: number;
  toAddress: string;
  txHash: string | null;
  status: string;
}

/**
 * How far the price may fall between the quote and the conversion before it
 * is refused (and nothing converts): `minReceive` is the quote less this.
 */
export const CONVERSION_TOLERANCE = 0.02;

export function useTokens(enabled = true) {
  return useQuery({
    queryKey: TOKENS_KEY,
    queryFn: async () => {
      const res = await api.get<{ data: TokenHolding[] }>("/user/tokens", {
        background: true,
      });
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled,
  });
}

export function useTokenAddress(token: string | null) {
  return useQuery({
    queryKey: ["token-address", token],
    queryFn: async () => {
      const res = await api.get<{ data: TokenAddress }>(
        `/user/tokens/${token}/address`,
      );
      return res.data;
    },
    enabled: !!token,
    // An address does not change; asking again only adds load.
    staleTime: Infinity,
  });
}

export async function quoteConversion(input: {
  token: string;
  amount: number;
  target: string;
}): Promise<TokenConversionQuote> {
  const res = await api.post<{ data: TokenConversionQuote }>(
    "/user/tokens/convert/quote",
    input,
    { retry: false },
  );
  return res.data;
}

export async function convertToken(input: {
  token: string;
  amount: number;
  target: string;
  minReceive?: number;
  reference: string;
}): Promise<TokenConversion> {
  const res = await api.post<{ data: TokenConversion }>(
    "/user/tokens/convert",
    input,
    { retry: false, idempotencyKey: input.reference },
  );
  return res.data;
}

export async function quoteTokenSend(input: {
  token: string;
  amount: number;
}): Promise<TokenSendQuote> {
  const res = await api.post<{ data: TokenSendQuote }>(
    "/user/tokens/send/quote",
    input,
    { retry: false },
  );
  return res.data;
}

export async function sendToken(input: {
  token: string;
  amount: number;
  toAddress: string;
  twoFactorCode?: string;
  reference: string;
}): Promise<TokenSend> {
  const res = await api.post<{ data: TokenSend }>("/user/tokens/send", input, {
    retry: false,
    idempotencyKey: input.reference,
  });
  return res.data;
}

/** A token's rate into `target`: what one token brings, after fees. */
export interface TokenRate {
  /** Of `target`, per one token, after the conversion fee. */
  perToken: number;
  target: string;
}

/**
 * The least of a token the exchange will convert, from a
 * TOKEN_CONVERSION_BELOW_MINIMUM refusal; null for any other error.
 */
export function conversionMinimumOf(error: unknown): number | null {
  if (apiErrorCode(error) !== 'TOKEN_CONVERSION_BELOW_MINIMUM') return null;
  const data = (error as { data?: { details?: { minAmount?: unknown } } })
    .data;
  const min = Number(data?.details?.minAmount);
  return Number.isFinite(min) && min > 0 ? min : null;
}

/**
 * Live rate for converting `token` to `target`, refreshed on the same tick as
 * the stablecoin rates. Priced by quoting one token; for a token the exchange
 * will not convert one of (its minimum is higher, as with TRX), at exactly
 * that minimum, which the refusal names. Indicative only: the conversion
 * prices again.
 */
export function useTokenRate(token: string, target: string) {
  return useQuery({
    queryKey: ['token-rate', token, target],
    queryFn: async (): Promise<TokenRate> => {
      const priceAt = async (amount: number): Promise<TokenRate> => {
        const quote = await quoteConversion({ token, amount, target });
        const credited = Number(quote.estimatedCredited);
        if (!(credited > 0)) throw new Error('No rate');
        return { perToken: credited / amount, target };
      };
      try {
        return await priceAt(1);
      } catch (error) {
        const minimum = conversionMinimumOf(error);
        if (minimum === null) throw error;
        return priceAt(minimum);
      }
    },
    refetchInterval: 15_000,
    staleTime: 15_000,
    retry: false,
  });
}
