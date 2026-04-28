import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerCareerStats } from "@/lib/stats";
import { isAuthenticated } from "@/lib/auth";
import SharePlayerButton from "./SharePlayerButton";

export const dynamic = "force-dynamic";

export default async function PlayerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const player = await prisma.player.findUnique({
    where: { id: params.id },
    include: { team: true },
  });
  if (!player) notFound();

  const stats = await getPlayerCareerStats(player.id);
  const isAdmin = isAuthenticated();

  const recentBatting = await prisma.battingEntry.findMany({
    where: { playerId: player.id },
    include: { innings: { include: { match: { include: { team1: true, team2: true } } } } },
    orderBy: { innings: { match: { matchDate: "desc" } } },
    take: 8,
  });

  return (
    <div className="space-y-8">
      <div className="card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-hitachi/10 text-2xl font-black text-hitachi">
          {player.name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Player profile
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{player.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Link href={`/teams/${player.team.id}`} className="font-medium text-hitachi hover:underline">
              {player.team.name}
            </Link>
            <span>·</span>
            <span>{prettyRole(player.role)}</span>
            <span>·</span>
            <span>{player.battingStyle}</span>
            {player.bowlingStyle && (
              <>
                <span>·</span>
                <span>{player.bowlingStyle}</span>
              </>
            )}
            {player.jerseyNumber != null && (
              <>
                <span>·</span>
                <span className="pill">#{player.jerseyNumber}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-end">
          <SharePlayerButton
            playerId={player.id}
            playerName={player.name}
            teamName={player.team.name}
          />
          {isAdmin && (
            <Link
              href={`/admin/players/${player.id}/edit`}
              className="btn-ghost"
            >
              <EditIcon />
              Edit
            </Link>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Batting career</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <StatTile label="Matches" value={stats.batting.matches} />
          <StatTile label="Innings" value={stats.batting.innings} />
          <StatTile label="Runs" value={stats.batting.runs} primary />
          <StatTile label="Avg" value={stats.batting.average || "-"} />
          <StatTile label="SR" value={stats.batting.strikeRate || "-"} />
          <StatTile label="HS" value={stats.batting.highest} />
          <StatTile label="50s" value={stats.batting.fifties} />
          <StatTile label="100s" value={stats.batting.hundreds} />
          <StatTile label="4s" value={stats.batting.fours} />
          <StatTile label="6s" value={stats.batting.sixes} />
          <StatTile label="Balls" value={stats.batting.balls} />
          <StatTile label="NO" value={stats.batting.notOuts} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Bowling career</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <StatTile label="Matches" value={stats.bowling.matches} />
          <StatTile label="Innings" value={stats.bowling.innings} />
          <StatTile label="Overs" value={stats.bowling.overs} />
          <StatTile label="Wickets" value={stats.bowling.wickets} primary />
          <StatTile label="Runs" value={stats.bowling.runsConceded} />
          <StatTile label="Avg" value={stats.bowling.average || "-"} />
          <StatTile label="Econ" value={stats.bowling.economy || "-"} />
          <StatTile label="Best" value={stats.bowling.best} />
        </div>
      </section>

      {recentBatting.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">Recent innings</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Match</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Runs</th>
                  <th className="px-5 py-3 text-right">Balls</th>
                  <th className="px-5 py-3 text-right">4s</th>
                  <th className="px-5 py-3 text-right">6s</th>
                  <th className="px-5 py-3 text-right">SR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 table-row-hover">
                {recentBatting.map((b) => {
                  const sr = b.balls > 0 ? Math.round((b.runs / b.balls) * 10000) / 100 : 0;
                  return (
                    <tr key={b.id}>
                      <td className="px-5 py-3">
                        <Link href={`/matches/${b.innings.matchId}`} className="text-slate-900 hover:underline">
                          {b.innings.match.team1.name} vs {b.innings.match.team2.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(b.innings.match.matchDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">
                        {b.runs}
                        {!b.isOut && <span className="text-slate-400">*</span>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{b.balls}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{b.fours}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{b.sixes}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{sr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  primary,
}: {
  label: string;
  value: number | string;
  primary?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl px-4 py-3 ring-1 " +
        (primary
          ? "bg-hitachi text-white ring-hitachi"
          : "bg-white text-slate-900 ring-slate-100")
      }
    >
      <div className="text-xl font-black tabular-nums">{value}</div>
      <div
        className={
          "text-[11px] font-semibold uppercase tracking-widest " +
          (primary ? "text-white/70" : "text-slate-500")
        }
      >
        {label}
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function prettyRole(role: string) {
  switch (role) {
    case "BATTER":
      return "Batter";
    case "BOWLER":
      return "Bowler";
    case "ALL_ROUNDER":
      return "All-rounder";
    case "WICKET_KEEPER":
      return "Wicket-keeper";
    default:
      return role;
  }
}
