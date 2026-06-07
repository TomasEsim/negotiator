import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL ships an optional native addon (used for local file: databases).
  // Keep it out of the bundler so it loads via native require at runtime.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
