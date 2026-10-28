import {
  mkdirSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
export const META_VERIFY_LIMITS = Object.freeze({
  placement: { requests: 1, maxOutputTokensPerRequest: 4000 },
  scoresheet: { requests: 1, maxOutputTokensPerRequest: 4000 },
  operations: { requests: 6, maxOutputTokensPerRequest: 2500, maxSeconds: 48 },
  totalRequests: 8,
  totalOutputTokens: 23000,
  transportRetries: 0,
});
/** Persist BEFORE dispatch. A timeout/crash never grants another paid attempt. */
export function claimModelAttempt(directory, run, feature) {
  if (
    !/^[a-f0-9]{10}$/.test(run) ||
    !["placement", "scoresheet", "operations"].includes(feature)
  )
    throw new Error("Invalid private verification fixture or feature");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `meta-${run}-${feature}.attempt.json`);
  let fd;
  try {
    fd = openSync(path, "wx", 0o600);
  } catch (e) {
    if (e.code === "EEXIST")
      throw new Error(
        "This model job was already attempted. Inspect its evidence/uncertain outcome; no automatic paid retry is permitted.",
      );
    throw e;
  }
  try {
    writeFileSync(
      fd,
      JSON.stringify(
        {
          run,
          feature,
          attemptedAt: new Date().toISOString(),
          outcome: "unknown-until-reconciled",
          limits: META_VERIFY_LIMITS,
        },
        null,
        2,
      ),
    );
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return path;
}
export function assertHumanResultReview(snapshot, recognition, gameId) {
  const game = snapshot.games.find((g) => g.id === gameId);
  const sheet = snapshot.scoresheets.find((s) => s.id === recognition.id);
  if (
    !game ||
    game.status !== "confirmed" ||
    game.home_score !== 78 ||
    game.away_score !== 43 ||
    !sheet ||
    sheet.source !== "meta" ||
    sheet.status !== "confirmed"
  )
    throw new Error(
      "Stop for administrator review: inspect the actual image/extraction and confirm the result in the normal UI before the operations stage. No approval or model call was performed.",
    );
}
