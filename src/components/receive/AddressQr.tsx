"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** A deposit address as a QR code, black on a white tile so it scans in dark mode too. */
export function AddressQr({ value, size = 180 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<{ value: string; url: string } | null>(null);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then((url) => live && setSrc({ value, url }))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [value, size]);

  return (
    <div className="flex justify-center">
      <div className="rounded-2xl bg-white p-3" style={{ width: size + 24, height: size + 24 }}>
        {src?.value === value && (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
          <img src={src.url} alt="QR code of the address" width={size} height={size} />
        )}
      </div>
    </div>
  );
}
