import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { syntheticProofs, syntheticProofSvg } from "./lib/synthetic-proofs.mjs";
// Preparation ONLY. No network/API execution and no key access. Separate authorization required.
mkdirSync(".local/synthetic-screening", { recursive: true });
const prepared = [];
let consistent;
for (const fixture of syntheticProofs) {
  const bytes =
    fixture.id === "duplicate-other-player"
      ? consistent
      : await sharp(Buffer.from(syntheticProofSvg(fixture)))
          .png()
          .toBuffer();
  if (fixture.id === "consistent") consistent = bytes;
  writeFileSync(`.local/synthetic-screening/${fixture.id}.png`, bytes);
  prepared.push({
    id: fixture.id,
    synthetic: true,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    expected: { name: fixture.expectedName, birthDate: fixture.expectedDob },
    preparedRequest: {
      model: "muse-spark-1.3",
      store: false,
      max_output_tokens: 1500,
      reasoning: { effort: "low" },
      instructions:
        "This visibly synthetic illustration is an experimental document-screening evaluation, not authentication. Report only observable text inconsistencies, unreadability or obvious visible alterations with evidence and limitations. Do not infer forgery from fonts, compression or metadata. Never assess faces or identity. Authenticity remains unverified; human review is mandatory.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                synthetic: true,
                fictionalRegistration: {
                  name: fixture.expectedName,
                  birthDate: fixture.expectedDob,
                },
              }),
            },
            {
              type: "input_image",
              image_url: `data:image/png;base64,${bytes.toString("base64")}`,
              detail: "high",
            },
          ],
        },
      ],
    },
  });
}
writeFileSync(
  ".local/synthetic-screening/prepared-experiment.json",
  JSON.stringify(
    {
      preparedAt: new Date().toISOString(),
      inferenceAuthorized: false,
      executedRequests: 0,
      distinctFromEightRequestVerification: true,
      cases: prepared,
    },
    null,
    2,
  ),
);
console.log(
  "Prepared six visibly synthetic cases and requests; zero API calls. Separate owner authorization required to execute any experiment.",
);
