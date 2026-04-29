import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

/**
 * Mid-match roster mutations. Lets the admin add or remove players from
 * either side without resetting any innings state — even while the match
 * is LIVE.
 *
 * Body:
 *   { action: "add",    playerId: string, side: 1 | 2 }
 *   { action: "remove", playerId: string }
 *
 * Removal is blocked for any player who has already batted or bowled in
 * this match, since they're tied to recorded scorecard entries.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const action = String(body.action || "");
  const playerId = String(body.playerId || "");
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  const match = await prisma.match.findUnique({ where: { id: params.id } });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  if (action === "add") {
    const side = Number(body.side);
    if (side !== 1 && side !== 2) {
      return NextResponse.json({ error: "side must be 1 or 2" }, { status: 400 });
    }

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    // If they're on the other side, move them; otherwise just upsert.
    const existing = await prisma.matchPlayer.findUnique({
      where: { matchId_playerId: { matchId: match.id, playerId } },
    });
    if (existing) {
      if (existing.side !== side) {
        // Refuse to flip sides if the player has any scorecard activity.
        const [bat, bow] = await Promise.all([
          prisma.battingEntry.count({
            where: { innings: { matchId: match.id }, playerId },
          }),
          prisma.bowlingEntry.count({
            where: { innings: { matchId: match.id }, playerId },
          }),
        ]);
        if (bat + bow > 0) {
          return NextResponse.json(
            {
              error:
                "This player has already batted or bowled in this match — they can't switch sides.",
            },
            { status: 400 },
          );
        }
        await prisma.matchPlayer.update({
          where: { id: existing.id },
          data: { side },
        });
      }
    } else {
      await prisma.matchPlayer.create({
        data: { matchId: match.id, playerId, side },
      });
    }
  } else if (action === "remove") {
    const [bat, bow] = await Promise.all([
      prisma.battingEntry.count({
        where: { innings: { matchId: match.id }, playerId },
      }),
      prisma.bowlingEntry.count({
        where: { innings: { matchId: match.id }, playerId },
      }),
    ]);
    if (bat + bow > 0) {
      return NextResponse.json(
        {
          error:
            "Can't drop a player who has already batted or bowled — their scorecard rows would be orphaned.",
        },
        { status: 400 },
      );
    }
    await prisma.matchPlayer.deleteMany({
      where: { matchId: match.id, playerId },
    });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  revalidatePath(`/admin/matches/${match.id}`);
  revalidatePath(`/matches/${match.id}`);
  return NextResponse.json({ ok: true });
}
