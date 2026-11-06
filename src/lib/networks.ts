// The networks the app supports, keyed by the backend network value.
// (zemfi-mobile keeps this in components/NetworkPicker.tsx.)
export interface NetworkOption {
  value: string;
  label: string;
}

export const NETWORK_OPTIONS: NetworkOption[] = [
  { value: 'tron', label: 'TRC-20' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'base', label: 'Base' },
  { value: 'arc', label: 'Arc' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'bsc', label: 'BNB Smart Chain' },
  { value: 'ethereum', label: 'Ethereum' },
];

export const networkLabel = (value: string): string =>
  NETWORK_OPTIONS.find((o) => o.value === value)?.label ?? value;
