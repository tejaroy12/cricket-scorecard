import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlayersPage() {
  const players = await prisma.player.findMany({
    orderBy: { name: "asc" },
    include: { team: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Players</h1>
        <p className="text-sm text-slate-500">
          All registered players across teams.
        </p>
      </div>

      {players.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          No players yet.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Player</th>
                  <th className="px-5 py-3">Team</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Bat</th>
                  <th className="px-5 py-3">Bowl</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 table-row-hover">
                {players.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/players/${p.id}`}
                        className="flex items-center gap-3 whitespace-nowrap"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-hitachi/10 text-xs font-bold text-hitachi">
                          {p.name
                            .split(" ")
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">
                            {p.name}
                          </div>
                          {p.jerseyNumber != null && (
                            <div className="text-xs text-slate-500">
                              #{p.jerseyNumber}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700 whitespace-nowrap">{p.team.name}</td>
                    <td className="px-5 py-3 text-slate-700">{p.role.replace("_", "-").toLowerCase()}</td>
                    <td className="px-5 py-3 text-slate-700">{p.battingStyle}</td>
                    <td className="px-5 py-3 text-slate-700">{p.bowlingStyle ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
