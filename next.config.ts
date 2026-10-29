import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: [
    "tesseract.js",
    "tesseract.js-core",
    "@tesseract.js-data/eng",
    "sharp",
  ],
  outputFileTracingIncludes: {
    "/api/guardian": [
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js/package.json",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@tesseract.js-data/eng/**/*",
      // The OCR worker is loaded dynamically. Trace its transitive runtime
      // dependencies explicitly; tracing only the parent module omits them.
      ...[
        "bmp-js",
        "idb-keyval",
        "is-url",
        "node-fetch",
        "regenerator-runtime",
        "wasm-feature-detect",
        "zlibjs",
        "whatwg-url",
        "webidl-conversions",
        "tr46",
      ].map((name) => `./node_modules/${name}/**/*`),
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
