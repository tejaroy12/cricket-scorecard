import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      innings: {
        include: {
          battingTeam: { include: { players: { select: { id: true } } } },
        },
      },
      team1: true,
      team2: true,
    },
  });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const innings1 = match.innings.find((i) => i.inningsNumber === 1);
  const innings2 = match.innings.find((i) => i.inningsNumber === 2);

  let winnerTeamId: string | null = null;
  let resultText = "Match abandoned";

  if (innings1 && innings2) {
    if (innings2.totalRuns > innings1.totalRuns) {
      winnerTeamId = innings2.battingTeamId;
      const chaseTeamSize = innings2.battingTeam.players.length;
      const maxWickets = Math.max(1, chaseTeamSize - 1);
      const wicketsLeft = Math.max(0, maxWickets - innings2.totalWickets);
      resultText = `${innings2.battingTeam.name} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
    } else if (innings1.totalRuns > innings2.totalRuns) {
      winnerTeamId = innings1.battingTeamId;
      const margin = innings1.totalRuns - innings2.totalRuns;
      resultText = `${innings1.battingTeam.name} won by ${margin} run${margin === 1 ? "" : "s"}`;
    } else {
      resultText = "Match tied";
    }
  } else if (innings1) {
    resultText = `${innings1.battingTeam.name} ended on ${innings1.totalRuns}/${innings1.totalWickets}`;
  }

  await prisma.$transaction(async (tx) => {
    if (innings1) await tx.innings.update({ where: { id: innings1.id }, data: { isClosed: true } });
    if (innings2) await tx.innings.update({ where: { id: innings2.id }, data: { isClosed: true } });
    await tx.match.update({
      where: { id: params.id },
      data: { status: "COMPLETED", winnerTeamId, resultText },
    });
  });

  return NextResponse.json({ ok: true, resultText });
}
