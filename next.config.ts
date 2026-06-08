import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL ships an optional native addon (used for local file: databases).
  // Keep it out of the bundler so it loads via native require at runtime.
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // The proxy buffers the request body (default cap 10MB). Raise it so large
    // PDF uploads (HypeAuditor exports ~10-12MB) pass through to the route in
    // local/multipart mode. On Vercel we upload to Blob, so the body stays tiny.
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
