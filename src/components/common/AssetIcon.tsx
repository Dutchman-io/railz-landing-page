import { assetColor } from "@/lib/assetMeta";

/*
 * Logos are served from public/assets, each saved under the currency code:
 * coins from the cryptocurrency-icons set (CC0), with SHIB, SUI and TON from
 * @web3icons/core (MIT), and flags for local currencies from flag-icons
 * (MIT). An asset without a file here -- one added server-side, or cNGN --
 * falls back to a disc in its brand colour with its code, so it still gets a
 * recognisable icon without a release.
 */
const COINS = new Set(["AAVE", "ADA", "BCH", "BNB", "BTC", "ETH", "LINK", "LTC", "POL", "SHIB", "SOL", "SUI", "TON", "TRX", "USDC", "USDT", "XLM", "XRP"]);
const FLAGS = new Set(["EUR", "GBP", "GHS", "KES", "NGN", "TZS", "USD", "ZAR"]);

const logoFor = (code: string): string | null => {
  if (COINS.has(code)) return `/assets/coins/${code}.svg`;
  if (FLAGS.has(code)) return `/assets/flags/${code}.svg`;
  return null;
};

/** A currency or token: its logo or flag, or a disc with its code. */
export function AssetIcon({ code, size = 40 }: { code: string; size?: number }) {
  const upper = code.toUpperCase();
  const logo = logoFor(upper);

  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a tiny local SVG; next/image adds nothing here
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5"
        style={{ width: size, height: size }}
      />
    );
  }

  const color = assetColor(upper);
  const label = upper.slice(0, upper.length > 4 ? 3 : 4);
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full border font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}22`,
        borderColor: `${color}55`,
        color,
        fontSize: label.length > 3 ? size * 0.24 : size * 0.3,
      }}
    >
      {label}
    </span>
  );
}
