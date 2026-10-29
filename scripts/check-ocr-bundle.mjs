import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
const root = process.argv.includes("--isolated") ? JSON.parse(readFileSync(".local/clean-build-report.json")).isolatedDirectory : process.cwd();
const trace = JSON.parse(readFileSync(join(root, ".next/server/app/api/guardian/route.js.nft.json")));
for (const fragment of ["node_modules/tesseract.js/package.json", "node_modules/tesseract.js/src/index.js", "node_modules/tesseract.js/src/worker-script/node/index.js", "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm", "node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz", "node_modules/bmp-js/lib/decoder.js", "node_modules/node-fetch/lib/index.js", "node_modules/whatwg-url/lib/URL.js", "node_modules/is-url/index.js", "node_modules/wasm-feature-detect/dist/cjs/index.cjs", "node_modules/zlibjs/bin/gunzip.min.js"])
  assert.ok(trace.files.some(p => p.replaceAll("\\", "/").endsWith(fragment)), "Guardian deployment trace is missing OCR runtime: " + fragment);
console.log("Guardian bundle trace includes the dynamic OCR worker, WASM, bundled language data and transitive runtime dependencies.");
