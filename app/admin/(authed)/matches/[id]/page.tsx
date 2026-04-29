import { notFound } from "next/navigation";
import { getMatchState } from "@/lib/matchState";
import { isScorer } from "@/lib/auth";
import ScoringConsole from "./ScoringConsole";
import { ScoreAuthGate } from "./ScoreAuthGate";

export const dynamic = "force-dynamic";

export default async function AdminMatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const state = await getMatchState(params.id);
  if (!state) notFound();

  // Live and scheduled matches require admin credentials before the
  // scoring console (or any of its mutation endpoints) becomes usable.
  // Completed matches show as a read-only scorecard for everybody.
  const requiresAuth =
    state.status === "LIVE" || state.status === "SCHEDULED";
  if (requiresAuth && !isScorer()) {
    return (
      <ScoreAuthGate
        matchTitle={`${state.team1.name} vs ${state.team2.name}`}
        matchId={state.id}
      />
    );
  }

  return <ScoringConsole initial={state as any} />;
}
