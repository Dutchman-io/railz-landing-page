import { assetColor } from "@/lib/assetMeta";

/**
 * A currency or token, as a disc in its own brand colour with its code.
 * Drawn, not fetched: no logo files, and a new asset gets an icon for free.
 */
export function AssetIcon({ code, size = 40 }: { code: string; size?: number }) {
  const color = assetColor(code);
  const label = code.toUpperCase().slice(0, code.length > 4 ? 3 : 4);
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
