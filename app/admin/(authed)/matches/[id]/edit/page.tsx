import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { EditMatchForm, RosterEntry } from "./EditMatchForm";

export const dynamic = "force-dynamic";

const FLASH_COOKIE = "hc_flash";

function setFlash(
  matchId: string,
  message: string,
  kind: "ok" | "err" = "ok",
) {
  cookies().set(FLASH_COOKIE, JSON.stringify({ message, kind }), {
    path: `/admin/matches/${matchId}/edit`,
    maxAge: 30,
    httpOnly: false,
    sameSite: "lax",
  });
}

function readFlash(matchId: string) {
  const c = cookies().get(FLASH_COOKIE);
  if (!c) return null;
  try {
    const parsed = JSON.parse(c.value);
    cookies().set(FLASH_COOKIE, "", {
      path: `/admin/matches/${matchId}/edit`,
      maxAge: 0,
    });
    return parsed as { message: string; kind: "ok" | "err" };
  } catch {
    return null;
  }
}

type EditMatchInput = {
  team1Id: string;
  team2Id: string;
  venue: string;
  oversPerSide: number;
  matchDate: string;
  team1Roster: RosterEntry[];
  team2Roster: RosterEntry[];
};

function dedupe(roster: RosterEntry[]): RosterEntry[] {
  const seen = new Set<string>();
  const out: RosterEntry[] = [];
  for (const r of roster ?? []) {
    if (!r?.playerId || seen.has(r.playerId)) continue;
    seen.add(r.playerId);
    out.push(r);
  }
  return out;
}

async function updateMatchAction(
  id: string,
  input: EditMatchInput,
): Promise<{ ok: boolean; error?: string }> {
  "use server";
  const { isAuthenticated } = await import("@/lib/auth");
  if (!isAuthenticated()) return { ok: false, error: "Unauthorized" };

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      innings: { select: { id: true, totalBalls: true } },
    },
  });
  if (!match) return { ok: false, error: "Match not found" };

  const ballsBowled = match.innings.reduce((s, i) => s + i.totalBalls, 0);
  const lockedFields = ballsBowled > 0;

  if (!input.team1Id || !input.team2Id) {
    return { ok: false, error: "Both teams are required." };
  }
  if (input.team1Id === input.team2Id) {
    return { ok: false, error: "Team 1 and Team 2 must be different." };
  }

  if (
    lockedFields &&
    (input.team1Id !== match.team1Id || input.team2Id !== match.team2Id)
  ) {
    return {
      ok: false,
      error:
        "This match already has balls scored. Teams can only be swapped before any ball is bowled.",
    };
  }

  const team1Roster = dedupe(input.team1Roster || []);
  const team2Roster = dedupe(input.team2Roster || []);
  const team1Ids = new Set(team1Roster.map((r) => r.playerId));
  const overlap = team2Roster.filter((r) => team1Ids.has(r.playerId));
  if (overlap.length > 0) {
    return { ok: false, error: "A player can't be on both sides." };
  }

  const overs = Number.isFinite(input.oversPerSide) ? input.oversPerSide : 20;
  const matchDate = input.matchDate ? new Date(input.matchDate) : match.matchDate;

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id },
      data: {
        team1Id: input.team1Id,
        team2Id: input.team2Id,
        venue: input.venue?.trim() || "Hitachi Sports Ground",
        oversPerSide: overs,
        matchDate,
      },
    });

    const desired = [
      ...team1Roster.map((r) => ({ ...r, side: 1 })),
      ...team2Roster.map((r) => ({ ...r, side: 2 })),
    ];
    const desiredByPlayer = new Map(
      desired.map((d) => [d.playerId, d] as const),
    );

    const existing = await tx.matchPlayer.findMany({
      where: { matchId: id },
      select: { id: true, playerId: true, side: true },
    });

    const existingByPlayer = new Map(
      existing.map((e) => [e.playerId, e] as const),
    );

    // Compute removals (existing not desired anymore).
    const toRemove = existing.filter((e) => !desiredByPlayer.has(e.playerId));

    if (toRemove.length > 0) {
      const removeIds = toRemove.map((r) => r.playerId);
      const [bat, bow] = await Promise.all([
        tx.battingEntry.findMany({
          where: { innings: { matchId: id }, playerId: { in: removeIds } },
          select: { playerId: true },
        }),
        tx.bowlingEntry.findMany({
          where: { innings: { matchId: id }, playerId: { in: removeIds } },
          select: { playerId: true },
        }),
      ]);
      const protectedIds = new Set([
        ...bat.map((b) => b.playerId),
        ...bow.map((b) => b.playerId),
      ]);
      const safeRemoveIds = toRemove
        .filter((r) => !protectedIds.has(r.playerId))
        .map((r) => r.id);
      if (safeRemoveIds.length > 0) {
        await tx.matchPlayer.deleteMany({
          where: { id: { in: safeRemoveIds } },
        });
      }
    }

    // Add new + update flags on existing.
    for (const d of desired) {
      const e = existingByPlayer.get(d.playerId);
      if (!e) {
        await tx.matchPlayer.create({
          data: {
            matchId: id,
            playerId: d.playerId,
            side: d.side,
            isCaptain: !!d.isCaptain,
            isViceCaptain: !!d.isViceCaptain,
            isWicketKeeper: !!d.isWicketKeeper,
          },
        });
      } else {
        await tx.matchPlayer.update({
          where: { id: e.id },
          data: {
            // Side may change pre-toss; once balls are scored we still allow
            // toggling captain/VC/WK but the side stays put because of the
            // protected-player guard above.
            side: e.side === d.side ? e.side : d.side,
            isCaptain: !!d.isCaptain,
            isViceCaptain: !!d.isViceCaptain,
            isWicketKeeper: !!d.isWicketKeeper,
          },
        });
      }
    }
  });

  revalidatePath("/admin/matches");
  revalidatePath(`/admin/matches/${id}`);
  revalidatePath(`/matches/${id}`);
  revalidatePath("/matches");
  revalidatePath("/");
  return { ok: true };
}

export default async function EditMatchPage({
  params,
}: {
  params: { id: string };
}) {
  const [match, teams, players] = await Promise.all([
    prisma.match.findUnique({
      where: { id: params.id },
      include: {
        team1: true,
        team2: true,
        matchPlayers: { include: { player: true } },
        innings: { select: { id: true, totalBalls: true } },
      },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.player.findMany({
      orderBy: { name: "asc" },
      include: { team: true },
    }),
  ]);

  if (!match) notFound();

  const flash = readFlash(match.id);
  const ballsBowled = match.innings.reduce((s, i) => s + i.totalBalls, 0);
  const teamsLocked = ballsBowled > 0;

  async function action(input: EditMatchInput) {
    "use server";
    return updateMatchAction(match!.id, input);
  }

  const initialRoster = (side: number): RosterEntry[] =>
    match.matchPlayers
      .filter((mp) => mp.side === side)
      .map((mp) => ({
        playerId: mp.playerId,
        isCaptain: !!mp.isCaptain,
        isViceCaptain: !!mp.isViceCaptain,
        isWicketKeeper: !!mp.isWicketKeeper,
      }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Edit match
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {match.team1.name} vs {match.team2.name}
          </h1>
          <p className="text-sm text-slate-500">
            {match.status === "SCHEDULED"
              ? "This match hasn't started yet — you can change anything."
              : teamsLocked
              ? "Balls have been scored: venue, overs, date and roster additions are still safe to change."
              : "Match is live but no ball has been bowled yet, so teams can still be swapped."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/matches/${match.id}`} className="btn-ghost">
            Back to scoring
          </Link>
        </div>
      </div>

      {flash && (
        <div
          className={
            "rounded-md px-4 py-3 text-sm ring-1 " +
            (flash.kind === "err"
              ? "bg-red-50 text-red-800 ring-red-100"
              : "bg-emerald-50 text-emerald-800 ring-emerald-100")
          }
        >
          {flash.message}
        </div>
      )}

      <EditMatchForm
        teamsLocked={teamsLocked}
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
        match={{
          id: match.id,
          team1Id: match.team1Id,
          team2Id: match.team2Id,
          venue: match.venue,
          oversPerSide: match.oversPerSide,
          matchDate: match.matchDate.toISOString(),
        }}
        initialTeam1Roster={initialRoster(1)}
        initialTeam2Roster={initialRoster(2)}
        updateAction={action}
      />
    </div>
  );
}
