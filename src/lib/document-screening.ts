import sharp from "sharp";
import { join } from "node:path";
import { createWorker } from "tesseract.js";
export type Finding = {
  code: string;
  source: "deterministic" | "local_ocr";
  evidence: string;
};
export type DocumentScreening = {
  version: 1;
  assessedAt: string;
  status: "no_specific_issue" | "review_required" | "unable_to_assess";
  authenticity: "unverified";
  findings: Finding[];
  limitations: string[];
  checks: {
    name: "match" | "mismatch" | "unknown";
    birthDate: "match" | "mismatch" | "unknown";
    mrz: "valid_checksums" | "invalid_checksums" | "not_supported";
  };
  image?: { width: number; height: number; contrast: number };
  perceptualHash?: string;
};
const normalize = (v: string) =>
  v
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function mrzCheck(value: string) {
  const weights = [7, 3, 1];
  return String(
    [...value].reduce(
      (n, c, i) =>
        n +
        (c === "<" ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55) *
          weights[i % 3],
      0,
    ) % 10,
  );
}
/** Only explicit English labels and unambiguous ISO dates. No inference from unrelated dates. */
export function assessDocumentText(
  text: string,
  expected: { name: string; birthDate: string },
  confidence: number,
): Pick<DocumentScreening, "status" | "findings" | "checks"> {
  const findings: Finding[] = [],
    lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  const nameLines = lines
    .filter((l) => /^(?:full\s+)?(?:player\s+)?name\s*:/i.test(l))
    .map((l) => l.replace(/^[^:]+:\s*/, ""));
  const exactName = lines.some(
    (l) => normalize(l) === normalize(expected.name),
  );
  const checks: DocumentScreening["checks"] = {
    name: "unknown",
    birthDate: "unknown",
    mrz: "not_supported",
  };
  if (confidence >= 60 && (nameLines.length || exactName)) {
    checks.name = (
      nameLines.length
        ? nameLines.every((n) => normalize(n) === normalize(expected.name))
        : exactName
    )
      ? "match"
      : "mismatch";
    if (checks.name === "mismatch")
      findings.push({
        code: "name_mismatch",
        source: "local_ocr",
        evidence:
          "A labeled name read by local OCR differs from the registered player. Inspect the original; OCR and name variations can cause false flags.",
      });
  }
  const dobLines = lines.filter((l) =>
    /(?:date\s+of\s+birth|birth\s*date|\bdob\b)/i.test(l),
  );
  const dates = [
    ...new Set(
      dobLines.flatMap((l) => l.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []),
    ),
  ].filter(
    (d) =>
      !Number.isNaN(Date.parse(d)) &&
      new Date(d).toISOString().slice(0, 10) === d,
  );
  if (confidence >= 60 && dates.length) {
    checks.birthDate =
      dates.length === 1 && dates[0] === expected.birthDate
        ? "match"
        : "mismatch";
    if (checks.birthDate === "mismatch")
      findings.push({
        code:
          dates.length > 1 ? "conflicting_birth_dates" : "birth_date_mismatch",
        source: "local_ocr",
        evidence:
          dates.length > 1
            ? "Local OCR found multiple different ISO dates on birth-date-labeled lines. This is observable conflicting text, not proof of editing."
            : "The ISO date on a birth-date-labeled line differs from the registered date. No registered data was changed.",
      });
  }
  const mrz = lines
    .map((l) => l.replace(/\s/g, ""))
    .find(
      (l, i, all) =>
        /^[A-Z0-9<]{44}$/.test(l) && i > 0 && /^P<[A-Z<]{42}$/.test(all[i - 1]),
    );
  if (confidence >= 60 && mrz) {
    const valid =
      mrzCheck(mrz.slice(0, 9)) === mrz[9] &&
      mrzCheck(mrz.slice(13, 19)) === mrz[19] &&
      mrzCheck(mrz.slice(21, 27)) === mrz[27] &&
      mrzCheck(mrz.slice(28, 42)) === mrz[42] &&
      mrzCheck(mrz.slice(0, 10) + mrz.slice(13, 20) + mrz.slice(21, 43)) ===
        mrz[43];
    checks.mrz = valid ? "valid_checksums" : "invalid_checksums";
    if (!valid)
      findings.push({
        code: "mrz_checksum",
        source: "deterministic",
        evidence:
          "A supported two-line TD3-style machine-readable field failed at least one 7-3-1 checksum. OCR errors also cause failures; a valid checksum does not authenticate an issuer.",
      });
    if (
      valid &&
      mrz.slice(13, 19) !== expected.birthDate.replaceAll("-", "").slice(2)
    ) {
      checks.birthDate = "mismatch";
      findings.push({
        code: "mrz_birth_date",
        source: "deterministic",
        evidence:
          "The checksum-valid YYMMDD field differs from the registered date. The field alone cannot establish the century or authenticity.",
      });
    }
  }
  if (
    confidence < 60 ||
    checks.name === "unknown" ||
    checks.birthDate === "unknown"
  )
    findings.push({
      code: "unreadable_or_unsupported",
      source: "local_ocr",
      evidence:
        "Required name or birth-date evidence could not be read reliably in the supported format. Local OCR supports English text and labeled ISO dates; other scripts/formats need human review.",
    });
  return {
    status: findings.some((f) => f.code !== "unreadable_or_unsupported")
      ? "review_required"
      : findings.length
        ? "unable_to_assess"
        : "no_specific_issue",
    findings,
    checks,
  };
}
export function hashDistance(a: string, b: string) {
  if (!/^[a-f0-9]{16}$/.test(a) || !/^[a-f0-9]{16}$/.test(b)) return 64;
  return [...(BigInt("0x" + a) ^ BigInt("0x" + b)).toString(2)].filter(
    (v) => v === "1",
  ).length;
}
/** Image and OCR bytes stay in this server process/worker; no remote OCR or Meta. */
export async function screenAgeDocument(
  bytes: Buffer,
  expected: { name: string; birthDate: string },
): Promise<DocumentScreening> {
  const base: DocumentScreening = {
    version: 1,
    assessedAt: new Date().toISOString(),
    status: "unable_to_assess",
    authenticity: "unverified",
    findings: [],
    checks: { name: "unknown", birthDate: "unknown", mrz: "not_supported" },
    limitations: [
      "Screening is not document authentication. Human original-document review remains mandatory.",
      "No facial recognition, issuer lookup or validated visual-tampering classifier. Fonts, metadata and compression do not prove forgery.",
      "Perceptual similarity is an experimental review hint; shared layouts can collide and edited/cropped images may be missed.",
    ],
  };
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    cancelled = false;
  try {
    const image = sharp(bytes, {
      limitInputPixels: 16_000_000,
      failOn: "error",
    })
      .rotate()
      .flatten({ background: "white" });
    const metadata = await image.metadata(),
      stats = await image.clone().greyscale().stats();
    const contrast = stats.channels[0].stdev;
    base.image = {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      contrast: Math.round(contrast * 10) / 10,
    };
    const pixels = await image
      .clone()
      .resize(9, 8, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();
    let hash = 0n;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        hash =
          (hash << 1n) | (pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? 1n : 0n);
    base.perceptualHash = hash.toString(16).padStart(16, "0");
    if (Math.min(base.image.width, base.image.height) < 300 || contrast < 12) {
      base.findings.push({
        code: "poor_image_quality",
        source: "deterministic",
        evidence:
          "Image resolution is below 300 pixels on one side or grayscale contrast is below the screening threshold. This limits readability; it is not evidence of forgery.",
      });
      return base;
    }
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Local OCR deadline")), 18000);
    });
    const task = (async () => {
      worker = await createWorker("eng", 1, {
        langPath: join(
          process.cwd(),
          "node_modules/@tesseract.js-data/eng/4.0.0",
        ),
        workerPath: join(
          process.cwd(),
          "node_modules/tesseract.js/src/worker-script/node/index.js",
        ),
        corePath: join(process.cwd(), "node_modules/tesseract.js-core"),
        cacheMethod: "none",
        logger: () => {},
        errorHandler: () => {},
      });
      if (cancelled) {
        await worker.terminate();
        throw new Error("Local OCR cancelled");
      }
      const normalized = await image
        .clone()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();
      return worker.recognize(normalized);
    })();
    const { data } = await Promise.race([task, deadline]);
    Object.assign(
      base,
      assessDocumentText(data.text, expected, data.confidence),
    );
    return base;
  } catch {
    base.findings.push({
      code: "processing_unavailable",
      source: "deterministic",
      evidence:
        "The image could not be decoded or local OCR did not complete within its bounded processing window. Inspect the original or request a clearer submission.",
    });
    return base;
  } finally {
    cancelled = true;
    if (timer) clearTimeout(timer);
    if (worker) await worker.terminate().catch(() => {});
  }
}
