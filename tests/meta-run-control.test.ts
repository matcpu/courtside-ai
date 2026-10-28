import { describe, expect, it } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  claimModelAttempt,
  META_VERIFY_LIMITS,
  assertHumanResultReview,
} from "../scripts/lib/meta-run-control.mjs";
describe("controlled live-run safety without inference", () => {
  it("blocks a duplicate attempt even if the prior process never recorded a response", () => {
    const directory = mkdtempSync(join(tmpdir(), "courtside-model-journal-"));
    try {
      const marker = claimModelAttempt(directory, "0123456789", "scoresheet");
      expect(JSON.parse(readFileSync(marker, "utf8")).outcome).toBe(
        "unknown-until-reconciled",
      );
      expect(() =>
        claimModelAttempt(directory, "0123456789", "scoresheet"),
      ).toThrow("already attempted");
      expect(() =>
        claimModelAttempt(directory, "0123456789", "operations"),
      ).not.toThrow();
    } finally {
      for (const name of readdirSync(directory))
        unlinkSync(join(directory, name));
      rmdirSync(directory);
    }
  });
  it("caps the three-job sequence at eight requests and 23000 output tokens", () => {
    expect(
      META_VERIFY_LIMITS.placement.requests +
        META_VERIFY_LIMITS.scoresheet.requests +
        META_VERIFY_LIMITS.operations.requests,
    ).toBe(8);
    expect(META_VERIFY_LIMITS.transportRetries).toBe(0);
    expect(META_VERIFY_LIMITS.totalOutputTokens).toBe(23000);
  });
  it("will not run operations against an unreviewed or manually substituted extraction", () => {
    const base = {
      games: [
        { id: "game", status: "confirmed", home_score: 78, away_score: 43 },
      ],
      scoresheets: [{ id: "sheet", source: "meta", status: "confirmed" }],
    };
    expect(() =>
      assertHumanResultReview(base, { id: "sheet" }, "game"),
    ).not.toThrow();
    expect(() =>
      assertHumanResultReview(
        { ...base, games: [{ ...base.games[0], status: "scheduled" }] },
        { id: "sheet" },
        "game",
      ),
    ).toThrow("administrator review");
    expect(() =>
      assertHumanResultReview(
        {
          ...base,
          scoresheets: [{ ...base.scoresheets[0], source: "manual" }],
        },
        { id: "sheet" },
        "game",
      ),
    ).toThrow("administrator review");
  });
});
