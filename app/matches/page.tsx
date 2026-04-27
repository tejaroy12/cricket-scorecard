import { prisma } from "@/lib/prisma";
import { MatchCard } from "@/components/MatchCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MatchesPage() {
  const matches = await prisma.match.findMany({
    include: {
      team1: true,
      team2: true,
      innings: { include: { battingTeam: true } },
    },
    orderBy: [{ status: "desc" }, { matchDate: "desc" }],
  });

  const live = matches.filter((m) => m.status === "LIVE");
  const upcoming = matches.filter((m) => m.status === "SCHEDULED");
  const completed = matches.filter((m) => m.status === "COMPLETED" || m.status === "ABANDONED");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">All matches</h1>
        <p className="text-sm text-slate-500">
          Live, upcoming, and completed fixtures.
        </p>
      </div>

      {live.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-hitachi">Live</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((m) => (
              <MatchCard key={m.id} {...m} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">Upcoming</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((m) => (
              <MatchCard key={m.id} {...m} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Completed</h2>
        {completed.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">
            No completed matches yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((m) => (
              <MatchCard key={m.id} {...m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
