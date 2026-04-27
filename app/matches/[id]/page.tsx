import { notFound } from "next/navigation";
import { getMatchState } from "@/lib/matchState";
import LiveMatchView from "./LiveMatchView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicMatchPage({
  params,
}: {
  params: { id: string };
}) {
  const state = await getMatchState(params.id);
  if (!state) notFound();
  return <LiveMatchView initial={state as any} />;
}
