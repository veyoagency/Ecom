import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-auth", "pg", "sequelize"],
};

export default nextConfig;
