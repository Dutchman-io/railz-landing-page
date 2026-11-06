import { Bricolage_Grotesque, IBM_Plex_Mono, Public_Sans } from "next/font/google";

/*
 * The marketing site's three faces, self-hosted by next/font. Each exposes a
 * CSS variable that the --display / --body / --mono tokens in site.css put in
 * front of their original fallback stacks. Bricolage keeps its optical-size
 * axis, as the old Google Fonts link did (opsz 12..96).
 */

export const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const body = Public_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
