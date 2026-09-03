import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },
  // googleapis is large; keep it external so Vercel serverless bundles stay within limits.
  serverExternalPackages: ["googleapis"],
};

export default nextConfig;
