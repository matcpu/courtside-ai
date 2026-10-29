import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  screenAgeDocument,
  hashDistance,
} from "../src/lib/document-screening.ts";
import { syntheticProofs } from "./lib/synthetic-proofs.mjs";
const cases = [];
for (const fixture of syntheticProofs) {
  const bytes = readFileSync(`.local/synthetic-screening/${fixture.id}.png`);
  const result = await screenAgeDocument(bytes, {
    name: fixture.expectedName,
    birthDate: fixture.expectedDob,
  });
  cases.push({
    id: fixture.id,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    status: result.status,
    findings: result.findings.map((f) => f.code),
    checks: result.checks,
    authenticity: result.authenticity,
    perceptualHash: result.perceptualHash,
  });
}
const original = readFileSync(".local/synthetic-screening/consistent.png"),
  recompressed = await sharp(original).jpeg({ quality: 75 }).toBuffer();
const processed = await screenAgeDocument(recompressed, {
  name: syntheticProofs[0].expectedName,
  birthDate: syntheticProofs[0].expectedDob,
});
const report = {
  at: new Date().toISOString(),
  synthetic: true,
  modelCalls: 0,
  cases,
  exactDuplicateDetected: cases[0].sha256 === cases[3].sha256,
  sameDocumentRecompressedDistance: hashDistance(
    cases[0].perceptualHash,
    processed.perceptualHash,
  ),
  consistentIllustrationFlagged: cases[0].status !== "no_specific_issue",
  limitation:
    "A small controlled illustration suite, not a detection accuracy estimate. The altered case has conflicting visible text: this does not demonstrate general visual-forgery detection. Perceptual hashes can collide across shared layouts. No real document was authenticated.",
};
writeFileSync(
  ".local/synthetic-screening/evaluation.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      ...report,
      cases: cases.map(({ sha256, perceptualHash, ...rest }) => rest),
    },
    null,
    2,
  ),
);
