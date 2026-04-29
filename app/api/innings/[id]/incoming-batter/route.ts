import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isScorer } from "@/lib/auth";

/**
 * Pick the next batter mid-innings after a wicket falls.
 *
 * Inputs (JSON body): { playerId: string }
 *
 * The server figures out which crease position is currently empty and
 * marks the new batter onCrease accordingly:
 *   - If the striker slot is empty (the dismissed batter was the
 *     striker) → new batter comes in as striker.
 *   - If the non-striker slot is empty → new batter comes in as
 *     non-striker.
 *
 * The endpoint refuses if:
 *   - the innings is already closed
 *   - the player is already on crease
 *   - the player has already been dismissed in this innings
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isScorer()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || !body.playerId) {
    return NextResponse.json(
      { error: "playerId is required" },
      { status: 400 },
    );
  }
  const playerId: string = body.playerId;

  const innings = await prisma.innings.findUnique({
    where: { id: params.id },
  });
  if (!innings) {
    return NextResponse.json({ error: "Innings not found" }, { status: 404 });
  }
  if (innings.isClosed) {
    return NextResponse.json(
      { error: "Innings is already closed" },
      { status: 400 },
    );
  }

  const onCrease = await prisma.battingEntry.findMany({
    where: { inningsId: params.id, isOnCrease: true },
  });
  if (onCrease.length >= 2) {
    return NextResponse.json(
      { error: "Two batters are already on crease" },
      { status: 400 },
    );
  }

  const existing = await prisma.battingEntry.findUnique({
    where: { inningsId_playerId: { inningsId: params.id, playerId } },
  });
  if (existing?.isOut) {
    return NextResponse.json(
      { error: "That batter has already been dismissed in this innings" },
      { status: 400 },
    );
  }
  if (existing?.isOnCrease) {
    return NextResponse.json(
      { error: "That batter is already on crease" },
      { status: 400 },
    );
  }

  // The new batter takes whichever crease slot is empty. If both slots are
  // empty (very early innings edge case) they come in as striker.
  const remaining = onCrease[0];
  const newIsStriker = !remaining ? true : !remaining.isStriker;

  const count = await prisma.battingEntry.count({
    where: { inningsId: params.id },
  });

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.battingEntry.update({
        where: { id: existing.id },
        data: { isOnCrease: true, isStriker: newIsStriker },
      });
    } else {
      await tx.battingEntry.create({
        data: {
          inningsId: params.id,
          playerId,
          battingOrder: count + 1,
          isOnCrease: true,
          isStriker: newIsStriker,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
