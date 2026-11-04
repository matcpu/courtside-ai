import { notFound } from "next/navigation";
import { JoinLeague } from "@/components/join-league";
export const dynamic = "force-dynamic";
export default function Join() {
  if (process.env.ORGANIZER_SETUP_ENABLED !== "true") notFound();
  return <JoinLeague />;
}
