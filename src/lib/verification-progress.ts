import type { PreseasonData } from "./preseason";

export function verificationProgress(
  player: PreseasonData["players"][number],
  invited: boolean,
  proofRequired = true,
) {
  switch (player.verification_status) {
    case "declaration_approved":
      return {
        label: "Eligibility approved · declaration only",
        next: "A human eligibility decision was recorded under the league’s declaration policy. No document was verified.",
      };
    case "approved":
      return {
        label: "Age verified",
        next: "The league recorded a human document decision. Team readiness still depends on the full roster and placement.",
      };
    case "pending":
      return {
        label: "Under administrator review",
        next: proofRequired
          ? "Document submitted. An authorized league reviewer must inspect the proof and decide. Coaches cannot open it."
          : "Guardian confirmation submitted. A league administrator must review the declared details and record eligibility; no document was submitted.",
      };
    case "resubmission":
      return {
        label: "Resubmission required",
        next: "Ask the guardian to reopen their secure link, read the review reason and upload a new document.",
      };
    case "rejected":
      return {
        label: "Ineligible or rejected",
        next: "Contact the league about the verification decision before requesting another submission.",
      };
    default:
      return invited
        ? {
            label: "Awaiting guardian submission",
            next: proofRequired
              ? "Share the private invitation with the expected guardian. They upload proof and provide consent through that link."
              : "Share the private link so the guardian can confirm the child’s details and provide consent.",
          }
        : {
            label: "Invitation not sent",
            next: proofRequired
              ? "Player added. Invite their guardian to upload proof and provide consent. A birth date alone does not verify age."
              : "Invite the guardian to confirm the child’s details and provide consent. A human eligibility decision is still required.",
          };
  }
}
