import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isScorer } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isScorer()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { tossWinnerId, tossDecision } = body as {
    tossWinnerId: string;
    tossDecision: "BAT" | "BOWL";
  };

  const match = await prisma.match.findUnique({ where: { id: params.id } });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status === "COMPLETED") return NextResponse.json({ error: "Match completed" }, { status: 400 });

  if (![match.team1Id, match.team2Id].includes(tossWinnerId)) {
    return NextResponse.json({ error: "Toss winner must be one of the teams" }, { status: 400 });
  }
  if (!["BAT", "BOWL"].includes(tossDecision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const battingTeamId =
    tossDecision === "BAT"
      ? tossWinnerId
      : tossWinnerId === match.team1Id
      ? match.team2Id
      : match.team1Id;
  const bowlingTeamId =
    battingTeamId === match.team1Id ? match.team2Id : match.team1Id;

  // Update match + create innings 1 if not exists
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: params.id },
      data: {
        tossWinnerId,
        tossDecision,
        status: "LIVE",
      },
    });
    const existing = await tx.innings.findUnique({
      where: { matchId_inningsNumber: { matchId: params.id, inningsNumber: 1 } },
    });
    if (!existing) {
      await tx.innings.create({
        data: {
          matchId: params.id,
          inningsNumber: 1,
          battingTeamId,
          bowlingTeamId,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
