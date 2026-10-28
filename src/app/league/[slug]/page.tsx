import { LeagueApp } from "@/components/league-app";
export default async function PublicLeague({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <LeagueApp publicSlug={slug} />;
}
