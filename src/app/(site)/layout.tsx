import type { Metadata, Viewport } from "next";
import { body, display, mono } from "@/components/site/fonts";
import "./site.css";

/*
 * Root layout for the public marketing pages. The signed-in app in (web) has
 * its own root layout, so moving between the two is a full page load and
 * neither one's CSS reaches the other.
 */

export const metadata: Metadata = {
  title: { default: "ZemFi", template: "%s · ZemFi" },
  icons: { icon: { url: "/icon.png", type: "image/png" }, apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef2fb",
};

// Runs before first paint, as the old <head> script did: the scroll reveal
// only hides content when JS and motion are both available.
const jsFlag =
  "if('IntersectionObserver' in window&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))" +
  "document.documentElement.classList.add('js');";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script adds the `js` class before hydration.
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: jsFlag }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
