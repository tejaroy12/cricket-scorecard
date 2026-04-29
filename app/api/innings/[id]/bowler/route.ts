import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isScorer } from "@/lib/auth";

/**
 * Change the current bowler (typically at the start of a new over).
 *
 * Persists the choice on `Innings.currentBowlerId` so the ball API can
 * always attribute new deliveries to the correct bowler — the previous
 * implementation guessed the bowler from "most balls bowled", which
 * silently kept counting new overs against the *original* bowler.
 *
 * Standard cricket rule: a bowler can't bowl two consecutive overs. We
 * enforce this whenever we're at an over boundary.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isScorer()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const bowlerId = body?.bowlerId;
  if (!bowlerId) return NextResponse.json({ error: "bowlerId required" }, { status: 400 });

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

  // Disallow consecutive overs from the same bowler.
  const lastLegal = await prisma.ball.findFirst({
    where: { inningsId: params.id, isLegal: true },
    orderBy: { sequence: "desc" },
  });
  const atOverBoundary =
    innings.totalBalls > 0 && innings.totalBalls % 6 === 0;
  if (atOverBoundary && lastLegal && lastLegal.bowlerId === bowlerId) {
    return NextResponse.json(
      {
        error:
          "Same bowler can't bowl two overs in a row. Pick a different bowler.",
      },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.bowlingEntry.findUnique({
      where: { inningsId_playerId: { inningsId: params.id, playerId: bowlerId } },
    });
    if (!existing) {
      await tx.bowlingEntry.create({
        data: { inningsId: params.id, playerId: bowlerId },
      });
    }
    await tx.innings.update({
      where: { id: params.id },
      data: { currentBowlerId: bowlerId },
    });
  });

  return NextResponse.json({ ok: true });
}
