/** The legal pages are served by this same app (src/app/(site)). */
export const PRIVACY_POLICY_URL = "/privacy";
export const TERMS_URL = "/terms";

const open = (url: string): void => {
  window.open(url, "_blank", "noopener");
};

/** Open the privacy policy in a new tab. */
export function openPrivacyPolicy(): Promise<void> {
  open(PRIVACY_POLICY_URL);
  return Promise.resolve();
}

/** Open the terms of service in a new tab. */
export function openTerms(): Promise<void> {
  open(TERMS_URL);
  return Promise.resolve();
}
