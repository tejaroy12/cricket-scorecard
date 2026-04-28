import Link from "next/link";
import { getLeaderboards } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeaderboardPage() {
  const { batters, bowlers } = await getLeaderboards(15);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Leaderboard</h1>
        <p className="text-sm text-slate-500">
          Top performers across the Hitachi cricket league.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Most runs</h2>
        {batters.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">
            No data yet.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 w-12">#</th>
                    <th className="px-5 py-3">Player</th>
                    <th className="px-5 py-3">Team</th>
                    <th className="px-5 py-3 text-right">Runs</th>
                    <th className="px-5 py-3 text-right">Balls</th>
                    <th className="px-5 py-3 text-right">4s</th>
                    <th className="px-5 py-3 text-right">6s</th>
                    <th className="px-5 py-3 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 table-row-hover">
                  {batters.map((b, i) => (
                    <tr key={b.player.id}>
                      <td className="px-5 py-3 font-bold text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Link href={`/players/${b.player.id}`} className="font-medium text-slate-900 hover:underline">
                          {b.player.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{b.player.team.name}</td>
                      <td className="px-5 py-3 text-right font-bold tabular-nums">{b.runs}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{b.balls}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{b.fours}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{b.sixes}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{b.strikeRate || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Most wickets</h2>
        {bowlers.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">
            No data yet.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 w-12">#</th>
                    <th className="px-5 py-3">Player</th>
                    <th className="px-5 py-3">Team</th>
                    <th className="px-5 py-3 text-right">Wickets</th>
                    <th className="px-5 py-3 text-right">Runs</th>
                    <th className="px-5 py-3 text-right">Balls</th>
                    <th className="px-5 py-3 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 table-row-hover">
                  {bowlers.map((b, i) => (
                    <tr key={b.player.id}>
                      <td className="px-5 py-3 font-bold text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Link href={`/players/${b.player.id}`} className="font-medium text-slate-900 hover:underline">
                          {b.player.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{b.player.team.name}</td>
                      <td className="px-5 py-3 text-right font-bold tabular-nums">{b.wickets}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{b.runsConceded}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{b.balls}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{b.economy || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
