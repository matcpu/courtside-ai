import { z } from "zod";
export const organizationAction = z.enum([
  "list",
  "get",
  "personal",
  "create",
  "rename",
  "create_program",
  "invite",
  "accept",
  "revoke_invite",
  "set_role",
  "remove_member",
  "transfer_owner",
  "grant_league_role",
]);
export type OrgRole = "owner" | "admin" | "member";
export type Organization = {
  id: string;
  name: string;
  role: OrgRole;
  revision: number;
  plan: "free" | "starter" | "pro";
  limits: Record<"programs" | "seasons" | "members", number>;
  usage: Record<
    "programs" | "seasons" | "members" | "pending_invitations",
    number
  >;
  programs: {
    id: string;
    name: string;
    seasons: {
      id: string;
      name: string;
      season: string;
      sport: string;
      role: string | null;
    }[];
  }[];
  members: { user_id: string; role: OrgRole }[];
  invitations: {
    id: string;
    email: string;
    role: string;
    expires_at: string;
    revoked_at: string | null;
    accepted_at: string | null;
  }[];
  billing: {
    status: string;
    cancel_at_period_end: boolean;
    period_end: string | null;
    synced_at: string | null;
    issue_code: string | null;
  };
};
export type Plan = {
  code: "free" | "starter" | "pro";
  name: string;
  limits: Organization["limits"];
};
