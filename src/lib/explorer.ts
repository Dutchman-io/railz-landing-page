/**
 * Block-explorer links for on-chain transactions.
 *
 * A hash on its own is a 66-character string a user can do nothing with; the
 * point of showing it is being able to go and verify the transfer. Networks
 * without a known explorer return null so the UI can fall back to copy-only
 * rather than opening something broken.
 *
 * Arc is deliberately absent: the only explorer for it is a testnet one, and
 * a production transaction must never link a user to a testnet explorer.
 * Add it back with its mainnet explorer URL once Arc mainnet is live.
 */
const TX_BASE: Record<string, string> = {
  ethereum: "https://etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  base: "https://basescan.org/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
  bsc: "https://bscscan.com/tx/",
  tron: "https://tronscan.org/#/transaction/",
};

export const explorerTxUrl = (
  network: string | null | undefined,
  txHash: string | null | undefined,
): string | null => {
  if (!network || !txHash) return null;
  const base = TX_BASE[network.toLowerCase()];
  return base ? `${base}${txHash}` : null;
};
