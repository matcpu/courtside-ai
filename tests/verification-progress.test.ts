import { expect, it } from "vitest";
import { verificationProgress } from "../src/lib/verification-progress";
import type { PreseasonData } from "../src/lib/preseason";
const player = (verification_status: string) =>
  ({ verification_status }) as PreseasonData["players"][number];
it("does not call a coach-entered date or legacy basic check document verification", () => {
  expect(verificationProgress(player("unverified"), false).label).toBe(
    "Invitation not sent",
  );
  expect(verificationProgress(player("legacy"), false).next).toContain(
    "does not verify age",
  );
});
it("distinguishes actual active invitation from an expired or revoked one", () => {
  expect(verificationProgress(player("invited"), true).label).toBe(
    "Awaiting guardian submission",
  );
  expect(verificationProgress(player("invited"), false).label).toBe(
    "Invitation not sent",
  );
});
it("keeps document submission pending a human decision regardless of invitation state", () => {
  expect(verificationProgress(player("pending"), false).label).toBe(
    "Under administrator review",
  );
  expect(verificationProgress(player("pending"), true).next).toContain(
    "Coaches cannot open",
  );
});
it("exposes resubmission, rejection and completed human decisions distinctly", () => {
  expect(verificationProgress(player("resubmission"), true).label).toBe(
    "Resubmission required",
  );
  expect(verificationProgress(player("rejected"), true).label).toBe(
    "Ineligible or rejected",
  );
  expect(verificationProgress(player("approved"), false).label).toBe(
    "Age verified",
  );
});
