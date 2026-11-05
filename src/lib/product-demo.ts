import { db } from "./server";
import type { ProductDemo } from "./product-navigation";
export async function productDemo(): Promise<ProductDemo | null> {
  try {
    const client = db();
    const { data: directory, error } = await client.rpc("public_leagues");
    if (error) return null;
    // Existing public demo records only. No demo league is created or published here.
    for (const row of (directory ?? [])
      .filter((league: { is_demo: boolean }) => league.is_demo)
      .slice(0, 12)) {
      if (process.env.ORGANIZER_SETUP_ENABLED === "true") {
        const { data: site } = await client.rpc("public_launch_site", {
          p_slug: row.slug,
        });
        if (site?.config?.theme === "courtside")
          return {
            id: row.id,
            name: row.name,
            season: site.league.season,
            href: `/league/${encodeURIComponent(row.slug)}/website`,
            publicDashboard: `/league/${encodeURIComponent(row.slug)}`,
          };
      }
    }
    const reference = directory?.find(
      (row: { slug: string }) => row.slug === "northstar-demo",
    );
    return reference
      ? {
          id: reference.id,
          name: reference.name,
          season: "Public reference league",
          href: `/league/${reference.slug}/website`,
          publicDashboard: `/league/${encodeURIComponent(reference.slug)}`,
        }
      : null;
  } catch {
    return null;
  }
}
