import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@compyl/contracts",
    "@compyl/ui",
    "@compyl/config",
  ],
};

export default nextConfig;
