import type { PreseasonData } from "./preseason";

export function verificationProgress(
  player: PreseasonData["players"][number],
  invited: boolean,
) {
  switch (player.verification_status) {
    case "approved":
      return {
        label: "Age verified",
        next: "The league recorded a human document decision. Team readiness still depends on the full roster and placement.",
      };
    case "pending":
      return {
        label: "Under administrator review",
        next: "Document submitted. An authorized league reviewer must inspect the proof and decide. Coaches cannot open it.",
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
            next: "Share the private invitation with the expected guardian. They upload proof and provide consent through that link.",
          }
        : {
            label: "Invitation not sent",
            next: "Player added. Invite their guardian to upload proof and provide consent. A birth date alone does not verify age.",
          };
  }
}
