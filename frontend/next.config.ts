import type { NextConfig } from "next";

const configuredRpc = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://rpc-bradbury.genlayer.com";
let rpcOrigin = "https://rpc-bradbury.genlayer.com";
try {
  const candidate = new URL(configuredRpc);
  if (candidate.protocol === "https:" || (candidate.protocol === "http:" && ["localhost", "127.0.0.1"].includes(candidate.hostname))) {
    rpcOrigin = candidate.origin;
  }
} catch {
  // Runtime configuration validation presents the actionable error in the UI.
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${rpcOrigin}` },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
