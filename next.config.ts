import path from "node:path";
import type { NextConfig } from "next";

// Standalone-bygget slås bara på när vi paketerar för produktion
// (BUILD_STANDALONE=1), så att lokal utveckling och `next start` fungerar som förut.
const standalone = process.env.BUILD_STANDALONE === "1";

const nextConfig: NextConfig = {
  ...(standalone
    ? {
        output: "standalone" as const,
        // Pinnas så att paketet ALLTID får server.js i roten, oavsett om det
        // finns andra lockfiler i närheten (annars gissar Next fel rot).
        outputFileTracingRoot: path.resolve(process.cwd()),
      }
    : {}),
  poweredByHeader: false,
  // Vi använder <img> för YouTube-tumnaglar; ingen bildoptimering behövs i drift.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  webpack(config) {
    // pdfjs-dist's Node canvas backend is unused in the browser build.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
