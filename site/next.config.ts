import type { NextConfig } from "next";

// Static export: `npm run build` writes plain files to out/, so the site can be served by any
// static host or by the existing API container. No Node server is needed.
// NEXT_PUBLIC_BASE_PATH serves the site from a sub-path (GitHub Pages: /membrain); empty on the MemBrain server.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
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
