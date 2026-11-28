import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers on every route. The CSP only carries directives that
  // cannot break Next's inline scripts; no script-src or connect-src.
  // The KYC selfie uses the camera on this origin, so camera is self.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // The old static site linked pages as *.html; keep those links working.
  async redirects() {
    return ["careers", "privacy", "terms", "delete-account"].map((page) => ({
      source: `/${page}.html`,
      destination: `/${page}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
