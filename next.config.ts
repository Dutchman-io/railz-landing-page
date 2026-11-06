import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
