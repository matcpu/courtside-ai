import { describe, it, expect, vi, afterEach } from "vitest";
import sharp from "sharp";
import {
  assessDocumentText,
  screenAgeDocument,
  hashDistance,
  mrzCheck,
} from "../src/lib/document-screening";
import {
  syntheticProofs,
  syntheticProofSvg,
} from "../scripts/lib/synthetic-proofs.mjs";
const expected = { name: "Fictional Demo Player", birthDate: "2013-02-03" };
afterEach(() => vi.unstubAllGlobals());
describe("local age-document screening (not authentication)", () => {
  it("accepts consistent labeled evidence without claiming authenticity", () => {
    const r = assessDocumentText(
      "Name: Fictional Demo Player\nDOB: 2013-02-03",
      expected,
      90,
    );
    expect(r.status).toBe("no_specific_issue");
    expect(r.checks).toMatchObject({ name: "match", birthDate: "match" });
  });
  it("flags name, date and conflicting-date mismatches without modifying registered data", () => {
    const r = assessDocumentText(
      "Name: Fictional Other Player\nDOB: 2015-02-03\nBirth Date: 2013-02-03",
      expected,
      95,
    );
    expect(r.findings.map((f) => f.code)).toEqual([
      "name_mismatch",
      "conflicting_birth_dates",
    ]);
    expect(expected.birthDate).toBe("2013-02-03");
  });
  it("does not mistake expiration dates or ambiguous formats for a confirmed birth date", () => {
    for (const text of [
      "Name: Fictional Demo Player\nExpires: 2013-02-03",
      "Name: Fictional Demo Player\nDOB: 03/02/2013",
      "Name: Fictional Demo Player\nDOB: 2013-02-31",
    ])
      expect(assessDocumentText(text, expected, 90).status).toBe(
        "unable_to_assess",
      );
  });
  it("uses unable-to-assess for low-confidence OCR, never a fraud accusation", () => {
    const r = assessDocumentText(
      "Name: Someone Else\nDOB: 2001-01-01",
      expected,
      40,
    );
    expect(r.status).toBe("unable_to_assess");
    expect(r.findings).toHaveLength(1);
  });
  it("checks supported MRZ checksums without claiming issuer authenticity", () => {
    expect(mrzCheck("740812")).toBe("2");
    const text =
      "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10";
    expect(assessDocumentText(text, expected, 95).checks.mrz).toBe(
      "valid_checksums",
    );
    expect(
      assessDocumentText(text.replace("7408122", "7408123"), expected, 95)
        .checks.mrz,
    ).toBe("invalid_checksums");
  });
  it("bounds perceptual matching and rejects invalid features", () => {
    expect(hashDistance("0000000000000001", "0000000000000003")).toBe(1);
    expect(hashDistance("invalid", "0000000000000000")).toBe(64);
  });
  it("processes real synthetic pixels locally with no HTTP model or OCR call", async () => {
    const fetch = vi.fn(() => {
      throw new Error("Network forbidden in local screening");
    });
    vi.stubGlobal("fetch", fetch);
    const bytes = await sharp(
      Buffer.from(syntheticProofSvg(syntheticProofs[0])),
    )
      .png()
      .toBuffer();
    const r = await screenAgeDocument(bytes, expected);
    expect(r.status).toBe("no_specific_issue");
    expect(r.authenticity).toBe("unverified");
    expect(r.perceptualHash).toMatch(/^[a-f0-9]{16}$/);
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toContain(expected.name);
    expect(JSON.stringify(r)).not.toContain(expected.birthDate);
  }, 30000);
  it("does not invent findings on a blank or unreadable image", async () => {
    const bytes = await sharp(
      Buffer.from(syntheticProofSvg(syntheticProofs[4])),
    )
      .png()
      .toBuffer();
    const r = await screenAgeDocument(bytes, expected);
    expect(r.status).toBe("unable_to_assess");
    expect(r.findings[0].code).toBe("poor_image_quality");
  });
});
