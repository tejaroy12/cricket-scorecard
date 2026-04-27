import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { players: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Teams</h1>
        <p className="text-sm text-slate-500">
          All registered teams in the Hitachi cricket league.
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          No teams yet. Ask an admin to create the first team.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/teams/${t.id}`}
              className="card flex items-center gap-4 p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white shadow">
                <span className="text-lg font-black tracking-tight">
                  {(t.shortName || t.name).slice(0, 3).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-slate-900">
                  {t.name}
                </div>
                <div className="text-xs text-slate-500">
                  {t._count.players} player{t._count.players === 1 ? "" : "s"}
                </div>
              </div>
              <span className="text-xs text-slate-400">&rarr;</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
