import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NewMatchForm } from "./NewMatchForm";

export const dynamic = "force-dynamic";

type CreateMatchInput = {
  team1Id: string;
  team2Id: string;
  venue: string;
  oversPerSide: number;
  matchDate: string;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
};

async function createMatchAction(
  input: CreateMatchInput,
): Promise<{ ok: boolean; error?: string }> {
  "use server";
  const { isAuthenticated } = await import("@/lib/auth");
  if (!isAuthenticated()) return { ok: false, error: "Unauthorized" };

  const { team1Id, team2Id, venue, oversPerSide, matchDate } = input;
  const team1PlayerIds = Array.from(new Set(input.team1PlayerIds || []));
  const team2PlayerIds = Array.from(new Set(input.team2PlayerIds || []));

  if (!team1Id || !team2Id) return { ok: false, error: "Pick both teams." };
  if (team1Id === team2Id)
    return { ok: false, error: "Team 1 and Team 2 must be different." };
  if (team1PlayerIds.length < 2 || team2PlayerIds.length < 2) {
    return {
      ok: false,
      error: "Each side needs at least 2 players.",
    };
  }
  // Defensive: ensure no overlap between sides
  const overlap = team1PlayerIds.filter((id) => team2PlayerIds.includes(id));
  if (overlap.length > 0) {
    return {
      ok: false,
      error: "A player can't be on both sides.",
    };
  }

  const date = matchDate ? new Date(matchDate) : new Date();
  const overs = Number.isFinite(oversPerSide) ? oversPerSide : 20;

  const created = await prisma.$transaction(async (tx) => {
    const match = await tx.match.create({
      data: {
        team1Id,
        team2Id,
        venue: venue || "Hitachi Sports Ground",
        oversPerSide: overs,
        matchDate: date,
        status: "SCHEDULED",
      },
    });

    const rows = [
      ...team1PlayerIds.map((pid) => ({
        matchId: match.id,
        playerId: pid,
        side: 1,
      })),
      ...team2PlayerIds.map((pid) => ({
        matchId: match.id,
        playerId: pid,
        side: 2,
      })),
    ];

    if (rows.length > 0) {
      await tx.matchPlayer.createMany({ data: rows });
    }
    return match;
  });

  redirect(`/admin/matches/${created.id}`);
}

export default async function NewMatchPage() {
  const [teams, players] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.player.findMany({
      orderBy: { name: "asc" },
      include: { team: true },
    }),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New match</h1>
        <p className="text-sm text-slate-500">
          Pick the two sides and assemble each lineup from your player database
          — players don&apos;t have to belong to those teams.
        </p>
      </div>

      <NewMatchForm
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          battingStyle: p.battingStyle,
          jerseyNumber: p.jerseyNumber,
          team: p.team ? { id: p.team.id, name: p.team.name } : null,
        }))}
        createMatchAction={createMatchAction}
      />
    </div>
  );
}
