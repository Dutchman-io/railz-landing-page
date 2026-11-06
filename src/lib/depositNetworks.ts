// Networks currently offered for crypto deposits (admin-controlled via
// depositEnabled, separate from the outbound-send `enabled` flag). Mirrors
// GET /sell/networks on the backend -- the same endpoint the admin portal's
// "Deposits on/off" switch actually governs.
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { NetworkOption } from './networks';

interface SupportedNetwork {
  id: string;
  displayName: string;
  evm: boolean;
}

export const DEPOSIT_NETWORKS_KEY = ['deposit-networks'] as const;

async function fetchDepositNetworks(): Promise<SupportedNetwork[]> {
  const res = await api.get<{ data?: SupportedNetwork[] }>('/sell/networks');
  return res.data ?? [];
}

export function useDepositNetworks() {
  return useQuery({
    queryKey: DEPOSIT_NETWORKS_KEY,
    queryFn: fetchDepositNetworks,
    staleTime: 30_000,
  });
}

/** Shaped for NetworkPicker, which knows nothing about the API response. */
export function toNetworkOptions(
  networks: SupportedNetwork[] | undefined,
): NetworkOption[] {
  return (networks ?? []).map((n) => ({
    value: n.id,
    label: n.displayName || n.id,
  }));
}
