// Crypto send: withdraw a stablecoin on-chain to an address the user provides.
// Mirrors the backend wallet/send endpoints (networks + quote + send).
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/**
 * A sendable stablecoin, as a plain code.
 *
 * This was a 'USDT' | 'USDC' union, which meant enabling a third coin on the
 * backend could not reach the app without an App Store release. The backend
 * decides what is sendable and says so in `assets`; the app renders what it is
 * given and looks the code up in the currency catalogue for a name and a
 * symbol.
 */
export type SendAsset = string;

export interface SendNetwork {
  network: string;
  flatFeeUsdt: number;
  minSendUsdt: number;
  recommended: boolean;
  assets: SendAsset[];
}

export interface SendNetworksResponse {
  // The stablecoins currently enabled for sending (admin-controlled).
  assets: SendAsset[];
  balances: Record<string, number>;
  networks: SendNetwork[];
}

/**
 * POST /wallet/send/quote: the server's own pricing of one send, what the
 * review shows. Both fees come out of `amount`:
 *   netAmount = amount - fee - partnerFee
 */
export interface SendQuote {
  asset: SendAsset;
  network: string;
  /** Gross: what leaves the balance. */
  amount: number;
  /** The network fee, in the asset. */
  fee: number;
  /** ZemFi's own fee, in the asset; 0 when none applies. Optional only so a
   * server that predates it still parses. */
  partnerFee?: number;
  /** What the recipient gets. */
  netAmount: number;
  minSendUsdt: number;
  balance: number;
  meetsMin: boolean;
  sufficientBalance: boolean;
  valid: boolean;
}

/** Read-only pricing; nothing is reserved, so a retry is harmless. */
export async function quoteSend(input: {
  asset: SendAsset;
  amount: number;
  network: string;
}): Promise<SendQuote> {
  const res = await api.post<{ data: SendQuote }>('/wallet/send/quote', input, {
    retry: true,
  });
  return res.data;
}

export interface SendResult {
  reference: string;
  asset: SendAsset;
  network: string;
  amount: number;
  fee: number;
  /** ZemFi's own fee, in the asset. */
  partnerFee?: number;
  netAmount: number;
  toAddress: string;
  txHash: string;
  status: string;
}

export const SEND_NETWORKS_KEY = ['send-networks'] as const;

export async function fetchSendNetworks(): Promise<SendNetworksResponse> {
  const res = await api.get<{ data?: SendNetworksResponse }>(
    '/wallet/send/networks',
    // Polled every 15s. See RequestOptions.background.
    { background: true },
  );
  return res.data ?? { assets: [], balances: {}, networks: [] };
}

export function useSendNetworks() {
  return useQuery({
    queryKey: SEND_NETWORKS_KEY,
    queryFn: fetchSendNetworks,
    refetchInterval: 15000,
    staleTime: 15000,
  });
}

export async function sendCrypto(input: {
  asset: SendAsset;
  amount: number;
  network: string;
  toAddress: string;
  twoFactorCode?: string;
  /**
   * Idempotency key for this send (useActionReference). Reuse it when the
   * user retries the same send; a new send gets a new one.
   */
  reference: string;
}): Promise<SendResult> {
  const res = await api.post<{ data: SendResult }>('/wallet/send', input, {
    idempotencyKey: input.reference,
    retry: false,
  });
  return res.data;
}

// A scanned QR may be a bare address or a payment URI (e.g. "tron:TR7..." or
// "ethereum:0xabc...?amount=1"). Strip any scheme prefix and query string.
export function parseAddressFromQr(data: string): string {
  let value = data.trim();
  const schemeMatch = value.match(/^[a-zA-Z]+:([^?]+)/);
  if (schemeMatch) value = schemeMatch[1];
  return value.split('?')[0].trim();
}
