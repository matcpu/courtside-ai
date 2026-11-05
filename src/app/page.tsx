import { LeagueApp } from "@/components/league-app";
import { productDemo } from "@/lib/product-demo";
import { workspaceView } from "@/lib/product-navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; league?: string; view?: string }>;
}) {
  const query = await searchParams;
  return (
    <LeagueApp
      demo={await productDemo()}
      entryAction={
        query.action === "signin" || query.action === "create"
          ? query.action
          : undefined
      }
      workspaceLeague={query.league}
      initialView={workspaceView(query.view)}
    />
  );
}
