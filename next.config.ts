import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/assist/:path*", destination: "https://assist.org/:path*" }];
  },
};

export default nextConfig;
