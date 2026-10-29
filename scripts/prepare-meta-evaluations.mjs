import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  scoresheetCases,
  questionnaireCases,
  scoresheetSvg,
  patchedProofSvg,
} from "./lib/meta-evaluation-fixtures.mjs";
import { syntheticProofs, syntheticProofSvg } from "./lib/synthetic-proofs.mjs";

// Preparation only: no credentials, API clients, remote writes or model calls.
const directory = ".local/meta-evaluations";
mkdirSync(directory, { recursive: true });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function saveImage(kind, id, bytes, mime, extra) {
  const digest = sha(bytes),
    suffix = mime === "image/jpeg" ? "jpg" : "png";
  const path = join(
    directory,
    `${kind}-${id}-${digest.slice(0, 12)}.${suffix}`,
  ).replaceAll("\\", "/");
  writeFileSync(path, bytes);
  const metadata = await sharp(bytes).metadata();
  return {
    id,
    feature: kind,
    synthetic: true,
    path,
    mime,
    sha256: digest,
    width: metadata.width,
    height: metadata.height,
    ...extra,
  };
}
const scoresheets = [],
  documentCases = [],
  rendered = new Map();
for (const definition of scoresheetCases) {
  let bytes;
  if (definition.source) bytes = readFileSync(definition.source);
  else if (definition.baseCase)
    bytes = await sharp(rendered.get(definition.baseCase))
      .rotate(2, { background: "#e8e6df" })
      .jpeg({ quality: 72 })
      .toBuffer();
  else
    bytes = await sharp(Buffer.from(scoresheetSvg(definition.artwork)))
      .png()
      .toBuffer();
  rendered.set(definition.id, bytes);
  const expected =
    definition.expected ??
    structuredClone(
      scoresheetCases.find((c) => c.id === definition.expectedFrom).expected,
    );
  scoresheets.push(
    await saveImage(
      "scoresheet",
      definition.id,
      bytes,
      definition.baseCase ? "image/jpeg" : "image/png",
      {
        transform: definition.transform,
        source:
          definition.source ??
          definition.baseCase ??
          "generated-vector-illustration",
        reuseExistingEvidence: Boolean(definition.reuseExistingEvidence),
        expected,
        criteria: definition.criteria,
      },
    ),
  );
}
let consistent;
for (const definition of syntheticProofs) {
  const bytes =
    definition.id === "duplicate-other-player"
      ? consistent
      : await sharp(Buffer.from(syntheticProofSvg(definition)))
          .png()
          .toBuffer();
  if (definition.id === "consistent") consistent = bytes;
  const expected = {
    registeredName: definition.expectedName,
    registeredBirthDate: definition.expectedDob,
    consistency:
      definition.id === "consistent"
        ? "consistent"
        : ["unreadable", "missing-evidence"].includes(definition.id)
          ? "unable_to_assess"
          : "inconsistent",
    visibleTextConflict: ["conflicting-dates", "altered-year"].includes(
      definition.id,
    ),
    knownConstructedAlteration: definition.id === "altered-year",
    exactDuplicateOf:
      definition.id === "duplicate-other-player" ? "consistent" : null,
    authenticity: "unverified",
  };
  documentCases.push(
    await saveImage(
      "synthetic_document_screening",
      definition.id,
      bytes,
      "image/png",
      {
        source: "existing-synthetic-proof-generator",
        expected,
        criteria: [
          "Distinguish observed text inconsistency, possible visual anomaly and unreadable/missing evidence.",
          "No authenticity guarantee, biometric assessment or automatic eligibility decision.",
        ],
      },
    ),
  );
}
documentCases.push(
  await saveImage(
    "synthetic_document_screening",
    "benign-recompressed-consistent",
    await sharp(consistent).jpeg({ quality: 75 }).toBuffer(),
    "image/jpeg",
    {
      source: "benign-JPEG-recompression-of-consistent",
      expected: {
        registeredName: "Fictional Demo Player",
        registeredBirthDate: "2013-02-03",
        consistency: "consistent",
        knownConstructedAlteration: false,
        visuallySameSourceAs: "consistent",
        exactDuplicateOf: null,
        authenticity: "unverified",
      },
      criteria: [
        "Measure false flags on a benign encoding change; compression alone is not evidence of forgery.",
        "Measure a missed perceptual-duplicate match separately from a false authenticity accusation.",
      ],
    },
  ),
);
documentCases.push(
  await saveImage(
    "synthetic_document_screening",
    "localized-single-year-patch",
    await sharp(Buffer.from(patchedProofSvg())).png().toBuffer(),
    "image/png",
    {
      source: "generated-localized-shaded-misaligned-year-patch",
      expected: {
        registeredName: "Fictional Demo Player",
        registeredBirthDate: "2013-02-03",
        visibleBirthDate: "2015-02-03",
        consistency: "inconsistent",
        visibleTextConflict: false,
        knownConstructedAlteration: true,
        observableAnomaly: "shaded misaligned year patch",
        authenticity: "unverified",
      },
      criteria: [
        "One visible birth date differs from registration; there is no second printed date to use as a contradiction shortcut.",
        "Assess observable shaded/misaligned field patch independently from the date mismatch. A visual anomaly is unconfirmed and does not prove forgery.",
      ],
    },
  ),
);
const questionnaires = questionnaireCases.map((c) => ({
  ...c,
  feature: "placement",
  synthetic: true,
  sha256: sha(Buffer.from(JSON.stringify(c.questionnaire))),
}));
const body = {
  version: 1,
  synthetic: true,
  modelCallsMade: 0,
  sourceRepository: "matcpu/courtside-ai",
  rendering:
    "Pinned sharp SVG renderer; operating-system font rasterization may differ. Every evaluated file is bound to its recorded SHA-256.",
  privacy:
    "Generated fictional illustrations only. No real identity template, photo, record, secret, mailbox or guardian capability is used.",
  constraints: [
    "Preparation is not successful model evaluation.",
    "No fixture permits automatic result confirmation, eligibility rejection, team movement or schedule publication.",
    "Model response quality and actual token/credit usage must be recorded by the separate authorized evaluation runner.",
  ],
  scoresheets,
  questionnaires,
  documents: documentCases,
};
const manifestDigest = sha(Buffer.from(JSON.stringify(body)));
const manifest = { ...body, fixtureSetSha256: manifestDigest };
writeFileSync(
  join(directory, `manifest-${manifestDigest.slice(0, 12)}.json`),
  JSON.stringify(manifest, null, 2),
);
writeFileSync(
  join(directory, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
console.log(
  `Prepared ${scoresheets.length} scoresheets, ${questionnaires.length} questionnaires and ${documentCases.length} synthetic proof cases. Zero model/network calls. Manifest: ${directory}/manifest.json`,
);
