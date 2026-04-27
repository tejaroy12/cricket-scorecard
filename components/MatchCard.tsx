import Link from "next/link";
import { formatOvers } from "@/lib/scoring";

type Innings = {
  id: string;
  inningsNumber: number;
  totalRuns: number;
  totalWickets: number;
  totalBalls: number;
  battingTeam: { name: string; shortName: string };
};

type MatchCardProps = {
  id: string;
  status: string;
  venue: string;
  matchDate: Date | string;
  oversPerSide: number;
  team1: { name: string; shortName: string };
  team2: { name: string; shortName: string };
  innings: Innings[];
  resultText?: string | null;
};

export function MatchCard(m: MatchCardProps) {
  const innings1 = m.innings.find((i) => i.inningsNumber === 1);
  const innings2 = m.innings.find((i) => i.inningsNumber === 2);

  return (
    <Link href={`/matches/${m.id}`} className="card block p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <StatusPill status={m.status} />
        <div className="text-xs text-slate-500">
          {new Date(m.matchDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <TeamLine
          team={m.team1}
          innings={innings1?.battingTeam.name === m.team1.name ? innings1 : innings2?.battingTeam.name === m.team1.name ? innings2 : undefined}
        />
        <TeamLine
          team={m.team2}
          innings={innings1?.battingTeam.name === m.team2.name ? innings1 : innings2?.battingTeam.name === m.team2.name ? innings2 : undefined}
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <div className="text-slate-500">{m.venue}</div>
        <div className="font-medium text-slate-700">{m.oversPerSide} overs</div>
      </div>

      {m.resultText && (
        <div className="mt-2 text-sm font-medium text-emerald-700">{m.resultText}</div>
      )}
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "LIVE") return <span className="pill-live">Live</span>;
  if (status === "COMPLETED") return <span className="pill-completed">Completed</span>;
  if (status === "ABANDONED") return <span className="pill bg-amber-50 text-amber-700">Abandoned</span>;
  return <span className="pill-scheduled">Scheduled</span>;
}

function TeamLine({
  team,
  innings,
}: {
  team: { name: string; shortName: string };
  innings?: Innings;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
          {(team.shortName || team.name).slice(0, 3).toUpperCase()}
        </div>
        <div className="font-medium text-slate-900">{team.name}</div>
      </div>
      {innings ? (
        <div className="text-right">
          <div className="text-base font-bold tabular-nums text-slate-900">
            {innings.totalRuns}/{innings.totalWickets}
          </div>
          <div className="text-xs tabular-nums text-slate-500">
            ({formatOvers(innings.totalBalls)} ov)
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400">Yet to bat</div>
      )}
    </div>
  );
}
