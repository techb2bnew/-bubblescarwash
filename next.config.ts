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
  // Produces .next/standalone/server.js — a single entry file that cPanel's
  // Node.js App Manager (Passenger) can launch directly. Vercel's own build
  // pipeline does NOT expect standalone output (it broke the build looking
  // for a .nft.json trace file standalone mode omits), so this only applies
  // outside Vercel — Vercel sets VERCEL=1 in its build environment.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
