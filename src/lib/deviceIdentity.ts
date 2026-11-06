// What this browser calls itself, for the "signed-in devices" list, sent as
// X-Device-Name the same way zemfi-mobile names the phone: e.g.
// "Chrome on Windows (web)".

const MAX_LENGTH = 60;

/** Printable, single-line and short -- it is rendered back in the sessions list. */
const sanitize = (raw: string): string =>
  raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LENGTH);

const browserName = (ua: string): string | null => {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
};

const osName = (ua: string): string | null => {
  if (/Windows/.test(ua)) return "Windows";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
};

let cached: string | null | undefined;

export const getDeviceLabel = (): string | null => {
  if (cached !== undefined) return cached;
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const browser = browserName(ua) ?? "Browser";
  const os = osName(ua);
  cached = sanitize(`${browser}${os ? ` on ${os}` : ""} (web)`) || null;
  return cached;
};
