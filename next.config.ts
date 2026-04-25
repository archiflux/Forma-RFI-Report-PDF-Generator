import type { NextConfig } from "next";

const APS = "https://developer.api.autodesk.com";

// Deployment mode:
//   `pnpm dev` / `pnpm build`              → server-capable Next (default)
//   `EXPORT=1 NEXT_BASE_PATH=/Repo pnpm build` → static export for GitHub Pages
const isExport = process.env.EXPORT === "1";
const basePath = process.env.NEXT_BASE_PATH ?? "";

const headers: NextConfig["headers"] = async () => [
  {
    source: "/(.*)",
    headers: [
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          // 'wasm-unsafe-eval' is required by @react-pdf/renderer, which
          // compiles a small WebAssembly module for font shaping / image
          // processing on Export. It permits WebAssembly.compile only — NOT
          // arbitrary eval() — so the read-only / no-injection posture is
          // preserved. Supported in Chrome/Edge/Safari/Firefox.
          "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
          // Workers default to script-src, but @react-pdf/renderer can spin
          // up blob:-backed workers for parallel rendering. Keep this tight.
          "worker-src 'self' blob:",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          `connect-src 'self' ${APS}`,
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self' https://developer.api.autodesk.com",
        ].join("; "),
      },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
    ],
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  ...(isExport
    ? {
        output: "export" as const,
        // Needed for GitHub Pages when served under /<repo>/; URLs get a trailing slash.
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : { headers }),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default config;
