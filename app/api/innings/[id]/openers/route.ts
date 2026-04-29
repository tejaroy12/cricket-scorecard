import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isScorer } from "@/lib/auth";

/**
 * Set the opening batters and opening bowler for an innings.
 * Body: { strikerId, nonStrikerId, bowlerId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isScorer()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { strikerId, nonStrikerId, bowlerId } = body as {
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string;
  };
  if (!strikerId || !nonStrikerId || !bowlerId) {
    return NextResponse.json({ error: "Missing players" }, { status: 400 });
  }
  if (strikerId === nonStrikerId) {
    return NextResponse.json({ error: "Striker and non-striker must differ" }, { status: 400 });
  }

  const innings = await prisma.innings.findUnique({ where: { id: params.id } });
  if (!innings) return NextResponse.json({ error: "Innings not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // Reset crease flags first
    await tx.battingEntry.updateMany({
      where: { inningsId: params.id },
      data: { isOnCrease: false, isStriker: false },
    });
    // Striker
    const sExisting = await tx.battingEntry.findUnique({
      where: { inningsId_playerId: { inningsId: params.id, playerId: strikerId } },
    });
    if (sExisting) {
      await tx.battingEntry.update({
        where: { id: sExisting.id },
        data: { isOnCrease: true, isStriker: true },
      });
    } else {
      await tx.battingEntry.create({
        data: {
          inningsId: params.id,
          playerId: strikerId,
          battingOrder: 1,
          isOnCrease: true,
          isStriker: true,
        },
      });
    }
    const nsExisting = await tx.battingEntry.findUnique({
      where: { inningsId_playerId: { inningsId: params.id, playerId: nonStrikerId } },
    });
    if (nsExisting) {
      await tx.battingEntry.update({
        where: { id: nsExisting.id },
        data: { isOnCrease: true, isStriker: false },
      });
    } else {
      await tx.battingEntry.create({
        data: {
          inningsId: params.id,
          playerId: nonStrikerId,
          battingOrder: 2,
          isOnCrease: true,
          isStriker: false,
        },
      });
    }
    // Bowler
    const bExisting = await tx.bowlingEntry.findUnique({
      where: { inningsId_playerId: { inningsId: params.id, playerId: bowlerId } },
    });
    if (!bExisting) {
      await tx.bowlingEntry.create({
        data: { inningsId: params.id, playerId: bowlerId },
      });
    }
    // Pin the current bowler so subsequent ball entries are attributed to
    // them until the admin explicitly changes who is bowling.
    await tx.innings.update({
      where: { id: params.id },
      data: { currentBowlerId: bowlerId },
    });
  });

  return NextResponse.json({ ok: true });
}
