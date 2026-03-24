import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Keep Turbopack rooted in this app (avoids wrong root when a parent folder has package-lock.json).
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
