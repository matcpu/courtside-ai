export const workspaceViews = [
  "Overview",
  "Launchpad",
  "Preseason Onboarding",
  "Meta AI activity",
  "Teams & rosters",
  "Schedule",
  "Scoresheets",
  "Standings",
  "Competitive balance",
  "Courts & gyms",
  "Notifications",
  "Settings",
] as const;
export type WorkspaceView = (typeof workspaceViews)[number];
export function workspaceView(value?: string): WorkspaceView {
  return workspaceViews.includes(value as WorkspaceView)
    ? (value as WorkspaceView)
    : "Overview";
}
export function workspaceHref(id: string, view?: WorkspaceView) {
  return `/workspace/${encodeURIComponent(id)}${view && view !== "Overview" ? `?view=${encodeURIComponent(view)}` : ""}`;
}
export function authorizedSelection(
  owned: { id: string }[],
  requested?: string,
  current = "",
) {
  const target = requested ?? current;
  return owned.some((league) => league.id === target) ? target : "";
}
export type ProductDemo = {
  id: string;
  name: string;
  season: string;
  href: string;
};
