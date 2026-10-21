import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  images: { unoptimized: true },
  transpilePackages: ["@freeharmony/engine", "@freeharmony/advice"],
  outputFileTracingRoot: join(__dirname, "..", ".."),
  env: { NEXT_PUBLIC_HOSTED_EDITION: process.env.VERCEL === "1" ? "1" : "0" },
  turbopack: {
    // Monorepo root — keeps a stray lockfile in $HOME from confusing detection.
    root: join(__dirname, "..", ".."),
  },
  async headers() {
    const dev = process.env.NODE_ENV !== "production";
    const localServices = process.env.VERCEL !== "1";
    const policy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
      "font-src 'self'", "media-src 'self' blob:", "worker-src 'self' blob:",
      `connect-src 'self'${localServices ? " http://127.0.0.1:11434 http://localhost:11434" : ""}${dev ? " ws://127.0.0.1:3000 ws://localhost:3000" : ""}`,
      "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ].join("; ");
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: policy },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
    ] }];
  },
};

export default nextConfig;
