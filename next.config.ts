import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep native modules out of the server bundle; they load from node_modules.
  serverExternalPackages: ["sharp", "@node-rs/argon2", "mysql2"],
};

export default nextConfig;
