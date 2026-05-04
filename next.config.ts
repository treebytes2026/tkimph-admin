import type { NextConfig } from "next";
import path from "node:path";

function imageRemotePatternFromApiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
    };
  } catch {
    return null;
  }
}

const apiImageRemotePattern = imageRemotePatternFromApiUrl();

const nextConfig: NextConfig = {
  // Keep Turbopack rooted in this app (avoids wrong root when a parent folder has package-lock.json).
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  images: {
    remotePatterns: [
      ...(apiImageRemotePattern ? [apiImageRemotePattern] : []),
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "api.tkimph.com",
      },
    ],
  },
};

export default nextConfig;
