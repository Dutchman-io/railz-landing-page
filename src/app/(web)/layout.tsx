import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

/*
 * Root layout for the signed-in web app and its auth pages. The marketing
 * site has its own root layout in (site), so neither one's CSS reaches the
 * other; moving between the two is a full page load.
 */

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: "ZemFi", template: "%s · ZemFi" },
  description: "Sign in to ZemFi to pay, get paid and hold stablecoins.",
  icons: { icon: "/icon.png", apple: "/apple-touch-icon.png" },
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a101c" },
  ],
};

export default function WebRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${bricolage.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
