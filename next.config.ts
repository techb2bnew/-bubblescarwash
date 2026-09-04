import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // googleapis is large; keep it external so Vercel serverless bundles stay within limits.
  serverExternalPackages: ["googleapis"],
  // Produces .next/standalone/server.js — a single entry file that cPanel's
  // Node.js App Manager (Passenger) can launch directly. Vercel ignores this
  // and builds normally, so it's safe to keep for both targets.
  output: "standalone",
};

export default nextConfig;
