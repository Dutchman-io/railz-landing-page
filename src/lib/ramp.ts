// Buying and selling a stablecoin against the user's local fiat, both from
// balances they already hold: lock a quote, then execute it.
//
// The asset is a parameter, not a constant. It used to be 'USDT' written into
// both quote bodies, which is why a user could receive USDC, see it on their
// balance, and have no way to turn it into money.
import { api } from './api';
import { BlockchainNetwork, Quote } from '@/types/api';

export interface QuoteInput {
  /** Units of `asset` on a sell; units of `fiatCurrency` on a buy. */
  amount: number;
  asset: string;
  network: BlockchainNetwork;
  /** The user's local fiat — settlement on a sell, funding on a buy. */
  fiatCurrency: string;
}

/** Lock an asset->fiat rate. Not retried — a stale quote is cheap to re-request. */
export async function lockSellQuote(input: QuoteInput): Promise<Quote> {
  const res = await api.post<{ data: Quote }>(
    '/sell/quote',
    {
      amount: input.amount,
      sourceCurrency: input.asset,
      destinationCurrency: input.fiatCurrency,
      type: 'sell',
      network: input.network,
    },
    { retry: false },
  );
  return res.data;
}

/** Lock a fiat->asset rate. The asset is bought from the user's fiat balance. */
export async function lockBuyQuote(input: QuoteInput): Promise<Quote> {
  const res = await api.post<{ data: Quote }>(
    '/buy/quote',
    {
      amount: input.amount,
      sourceCurrency: input.fiatCurrency,
      destinationCurrency: input.asset,
      type: 'buy',
      network: input.network,
    },
    { retry: false },
  );
  return res.data;
}

/**
 * What an executed conversion reports back.
 *
 * `asset`/`assetSold`/`assetCredited` are the current names. The `usdt*` ones
 * are the same numbers under the names they had when USDT was the only asset;
 * a server that has not been redeployed yet still sends only those, so both
 * are optional and read through the helpers below.
 */
export interface SellResult {
  reference: string;
  asset?: string;
  assetSold?: number;
  usdtSold?: number;
  fiatCurrency: string;
  fiatCredited: number;
}

export interface BuyResult {
  reference: string;
  asset?: string;
  assetCredited?: number;
  usdtCredited?: number;
  fiatCurrency: string;
  fiatSpent: number;
}

/** Units of the asset that were bought, whichever name the server used. */
export const creditedAmount = (r: BuyResult): number =>
  r.assetCredited ?? r.usdtCredited ?? 0;

/**
 * Execute the sell from the asset balance. Not retried (money). The quote is
 * single-use, so its id doubles as the idempotency key.
 */
export async function executeSell(quoteId: string): Promise<SellResult> {
  const res = await api.post<{ data: SellResult }>(
    '/sell/execute',
    { quoteId },
    { idempotencyKey: quoteId, retry: false },
  );
  return res.data;
}

/**
 * Execute the buy from the fiat balance. Not retried (money). The quote is
 * single-use, so its id doubles as the idempotency key.
 */
export async function executeBuy(quoteId: string): Promise<BuyResult> {
  const res = await api.post<{ data: BuyResult }>(
    '/buy/execute',
    { quoteId },
    { idempotencyKey: quoteId, retry: false },
  );
  return res.data;
}
