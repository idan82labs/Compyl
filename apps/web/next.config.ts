import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@reviewlayer/contracts",
    "@reviewlayer/ui",
    "@reviewlayer/config",
  ],
};

export default nextConfig;
