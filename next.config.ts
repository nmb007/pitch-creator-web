import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typedRoutes: true,
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
