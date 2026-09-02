import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // googleapis is large; keep it external so Vercel serverless bundles stay within limits.
  serverExternalPackages: ["googleapis"],
};

export default nextConfig;
