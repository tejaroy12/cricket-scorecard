import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: {
      players: { orderBy: { name: "asc" } },
    },
  });
  if (!team) notFound();

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ team1Id: team.id }, { team2Id: team.id }],
    },
    orderBy: { matchDate: "desc" },
    include: {
      team1: true,
      team2: true,
      innings: { include: { battingTeam: true } },
    },
    take: 10,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 text-white shadow">
          <span className="text-2xl font-black tracking-tight">
            {(team.shortName || team.name).slice(0, 3).toUpperCase()}
          </span>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-hitachi">
            Team
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{team.name}</h1>
          <p className="text-sm text-slate-500">
            {team.players.length} players · {matches.length} recent matches
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Squad</h2>
        {team.players.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">No players yet.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {team.players.map((p) => (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="card flex items-center gap-3 p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-hitachi/10 text-sm font-bold text-hitachi">
                  {p.name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900">
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {prettyRole(p.role)} · {p.battingStyle}
                  </div>
                </div>
                {p.jerseyNumber != null && (
                  <span className="pill">#{p.jerseyNumber}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Recent matches</h2>
        {matches.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">No matches yet.</div>
        ) : (
          <div className="card divide-y divide-slate-100">
            {matches.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
              >
                <div className="text-sm">
                  <div className="font-medium text-slate-900">
                    {m.team1.name} vs {m.team2.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(m.matchDate).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {m.venue}
                  </div>
                </div>
                <span
                  className={
                    m.status === "LIVE"
                      ? "pill-live"
                      : m.status === "COMPLETED"
                      ? "pill-completed"
                      : "pill-scheduled"
                  }
                >
                  {m.status === "LIVE" ? "Live" : m.status.charAt(0) + m.status.slice(1).toLowerCase()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
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
