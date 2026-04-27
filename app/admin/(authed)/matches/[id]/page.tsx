import { notFound } from "next/navigation";
import { getMatchState } from "@/lib/matchState";
import ScoringConsole from "./ScoringConsole";

export const dynamic = "force-dynamic";

export default async function AdminMatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const state = await getMatchState(params.id);
  if (!state) notFound();

  return <ScoringConsole initial={state as any} />;
}
