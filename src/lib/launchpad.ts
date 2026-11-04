/** Starter materials derived only from public league identity information. */
export function launchIdentity(name: string) {
  const root = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 25) || "basketballleague";
  const handles = [root, `${root}hoops`, `${root}basketball`]
    .map((value) => value.slice(0, 30));
  return {
    handles: [...new Set(handles)],
    domains: [...new Set([`${root}.com`, `${root}.ca`, `${root}basketball.com`])],
  };
}

export function launchSocialKit(
  name: string,
  season: string,
  divisionNames: string[],
  website: string,
) {
  const ageGroups = divisionNames.length
    ? `Divisions: ${divisionNames.join(", ")}.`
    : "Division details will be announced soon.";
  return {
    bio: `${name} | Youth basketball league. ${season}. Fixtures, standings and team registration: ${website}`,
    posts: [
      {
        title: "Introducing the league",
        copy: `Welcome to ${name}! We're getting ready for ${season}. Follow along for team updates, schedules and a season built around the game. ${website}`,
      },
      {
        title: "Season information",
        copy: `${season} is taking shape at ${name}. ${ageGroups} Find official league information at ${website}`,
      },
      {
        title: "Join the season",
        copy: `Coaches and teams: interested in ${name}? Visit our league portal for current registration information. Registration may not yet be open. ${website}`,
      },
    ],
  };
}
