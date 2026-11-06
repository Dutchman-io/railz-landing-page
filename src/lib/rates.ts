// Live stablecoin/fiat pricing, backed by GET /rate.
//
// User-authenticated rather than partner-authenticated: the partner API key
// behind the payments partner's /ramp/* routes must never ship in an app bundle. This gives
// a rate for previewing a conversion; it does NOT lock one. Locking happens at
// checkout, via the quote routes in ./ramp.
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { BlockchainNetwork, RateSnapshot } from '@/types/api';
import { QuoteParameters } from './conversion';

// Refresh cadence for the displayed rate. The rate the user sees should never be
// more than one tick stale.
export const RATE_REFRESH_MS = 15_000;

export async function fetchRate(
  network: BlockchainNetwork,
  asset?: string,
): Promise<RateSnapshot> {
  // `asset` picks the stablecoin to price. Omitted, the server prices its own
  // default, which is what this call did before the parameter existed.
  const query = new URLSearchParams({ network });
  if (asset) query.set('asset', asset);
  const res = await api.get<{ data: RateSnapshot }>(`/rate?${query}`, {
    // Polled every 15s; a 409 here is a timer, not a decision the user made.
    background: true,
  });
  return res.data;
}

export function useRate(
  network: BlockchainNetwork,
  asset?: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['rate', network, asset ?? null],
    queryFn: () => fetchRate(network, asset),
    refetchInterval: RATE_REFRESH_MS,
    staleTime: RATE_REFRESH_MS,
    enabled: options.enabled ?? true,
  });
}

// The snapshot carries both directions; the conversion math wants the one rate
// that applies to the mode in play. `exchangeFeeAsset` is the current name;
// `exchangeFeeUsdt` is the same number under the name it had when USDT was the
// only asset, and is read as a fallback until every server is on the new one.
export function toQuoteParameters(
  snapshot: RateSnapshot,
  mode: 'buy' | 'sell',
): QuoteParameters {
  return {
    rate: mode === 'buy' ? snapshot.buyRate : snapshot.sellRate,
    exchangeFeeAsset:
      snapshot.exchangeFeeAsset ?? snapshot.exchangeFeeUsdt ?? 0,
  };
}
