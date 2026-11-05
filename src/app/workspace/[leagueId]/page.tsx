import { notFound } from "next/navigation";
import { z } from "zod";
import { LeagueApp } from "@/components/league-app";
import { workspaceView } from "@/lib/product-navigation";
export default async function Workspace({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { leagueId } = await params;
  if (!z.uuid().safeParse(leagueId).success) notFound();
  const query = await searchParams;
  return (
    <LeagueApp
      workspaceLeague={leagueId}
      initialView={workspaceView(query.view)}
    />
  );
}
