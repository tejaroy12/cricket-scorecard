import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isScorer } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isScorer()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: { innings: true },
  });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const innings1 = match.innings.find((i) => i.inningsNumber === 1);
  if (!innings1) {
    return NextResponse.json({ error: "First innings not started" }, { status: 400 });
  }
  const innings2Existing = match.innings.find((i) => i.inningsNumber === 2);
  if (innings2Existing) {
    return NextResponse.json({ error: "Second innings already exists" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.innings.update({
      where: { id: innings1.id },
      data: { isClosed: true },
    });
    await tx.innings.create({
      data: {
        matchId: match.id,
        inningsNumber: 2,
        battingTeamId: innings1.bowlingTeamId,
        bowlingTeamId: innings1.battingTeamId,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
