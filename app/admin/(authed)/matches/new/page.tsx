import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NewMatchForm } from "./NewMatchForm";

export const dynamic = "force-dynamic";

type RosterEntry = {
  playerId: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isWicketKeeper: boolean;
};

type CreateMatchInput = {
  team1Id: string;
  team2Id: string;
  venue: string;
  oversPerSide: number;
  matchDate: string;
  team1Roster: RosterEntry[];
  team2Roster: RosterEntry[];
};

function dedupeRoster(roster: RosterEntry[]): RosterEntry[] {
  const seen = new Set<string>();
  const out: RosterEntry[] = [];
  for (const r of roster ?? []) {
    if (!r?.playerId || seen.has(r.playerId)) continue;
    seen.add(r.playerId);
    out.push(r);
  }
  return out;
}

async function createMatchAction(
  input: CreateMatchInput,
): Promise<{ ok: boolean; error?: string }> {
  "use server";
  const { isAuthenticated } = await import("@/lib/auth");
  if (!isAuthenticated()) return { ok: false, error: "Unauthorized" };

  const { team1Id, team2Id, venue, oversPerSide, matchDate } = input;
  const team1Roster = dedupeRoster(input.team1Roster || []);
  const team2Roster = dedupeRoster(input.team2Roster || []);

  if (!team1Id || !team2Id) return { ok: false, error: "Pick both teams." };
  if (team1Id === team2Id)
    return { ok: false, error: "Team 1 and Team 2 must be different." };
  if (team1Roster.length < 2 || team2Roster.length < 2) {
    return {
      ok: false,
      error: "Each side needs at least 2 players.",
    };
  }

  const team1Ids = new Set(team1Roster.map((r) => r.playerId));
  const overlap = team2Roster.filter((r) => team1Ids.has(r.playerId));
  if (overlap.length > 0) {
    return { ok: false, error: "A player can't be on both sides." };
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
      ...team1Roster.map((r) => ({
        matchId: match.id,
        playerId: r.playerId,
        side: 1,
        isCaptain: !!r.isCaptain,
        isViceCaptain: !!r.isViceCaptain,
        isWicketKeeper: !!r.isWicketKeeper,
      })),
      ...team2Roster.map((r) => ({
        matchId: match.id,
        playerId: r.playerId,
        side: 2,
        isCaptain: !!r.isCaptain,
        isViceCaptain: !!r.isViceCaptain,
        isWicketKeeper: !!r.isWicketKeeper,
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
          — players don&apos;t have to belong to those teams. Tag each side&apos;s
          captain (C), vice-captain (VC) and wicket-keeper (WK).
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
          phone: p.phone,
          team: p.team ? { id: p.team.id, name: p.team.name } : null,
        }))}
        createMatchAction={createMatchAction}
      />
    </div>
  );
}
