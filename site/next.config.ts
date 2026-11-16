import type { NextConfig } from "next";

// Static export: `npm run build` writes plain files to out/, so the site can be served by any
// static host or by the existing API container. No Node server is needed.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
