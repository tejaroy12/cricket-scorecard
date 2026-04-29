import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isScorer, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isScorer()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      matchPlayers: { select: { id: true, side: true } },
    },
  });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const innings1 = match.innings.find((i) => i.inningsNumber === 1);
  const innings2 = match.innings.find((i) => i.inningsNumber === 2);
  const innings3 = match.innings.find((i) => i.inningsNumber === 3);
  const innings4 = match.innings.find((i) => i.inningsNumber === 4);

  function rosterSize(teamId: string, fallback: number): number {
    const side =
      match!.team1Id === teamId ? 1 : match!.team2Id === teamId ? 2 : 0;
    const fromMatch = match!.matchPlayers.filter((mp) => mp.side === side).length;
    return fromMatch > 0 ? fromMatch : fallback;
  }

  let winnerTeamId: string | null = null;
  let resultText = "Match abandoned";
  let isTie = false;

  if (innings1 && innings2) {
    if (innings2.totalRuns > innings1.totalRuns) {
      winnerTeamId = innings2.battingTeamId;
      const chaseTeamSize = rosterSize(
        innings2.battingTeamId,
        innings2.battingTeam.players.length,
      );
      const maxWickets = Math.max(1, chaseTeamSize - 1);
      const wicketsLeft = Math.max(0, maxWickets - innings2.totalWickets);
      resultText = `${innings2.battingTeam.name} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
    } else if (innings1.totalRuns > innings2.totalRuns) {
      winnerTeamId = innings1.battingTeamId;
      const margin = innings1.totalRuns - innings2.totalRuns;
      resultText = `${innings1.battingTeam.name} won by ${margin} run${margin === 1 ? "" : "s"}`;
    } else {
      isTie = true;
      resultText = "Match tied";
    }
  } else if (innings1) {
    resultText = `${innings1.battingTeam.name} ended on ${innings1.totalRuns}/${innings1.totalWickets}`;
  }

  // Super-over takes precedence over the regular match result when present.
  if (innings3 && innings4) {
    if (innings4.totalRuns > innings3.totalRuns) {
      winnerTeamId = innings4.battingTeamId;
      resultText = `${innings4.battingTeam.name} won the Super Over by ${innings4.totalRuns - innings3.totalRuns} run${innings4.totalRuns - innings3.totalRuns === 1 ? "" : "s"}`;
      isTie = false;
    } else if (innings3.totalRuns > innings4.totalRuns) {
      winnerTeamId = innings3.battingTeamId;
      resultText = `${innings3.battingTeam.name} won the Super Over by ${innings3.totalRuns - innings4.totalRuns} run${innings3.totalRuns - innings4.totalRuns === 1 ? "" : "s"}`;
      isTie = false;
    } else {
      isTie = true;
      resultText = "Super Over tied — match remains tied";
    }
  }

  // If the match is tied and no super over has been played yet, return early
  // and signal the UI so it can offer to start one. We don't mark the match
  // COMPLETED yet so the admin can still trigger the super over.
  if (isTie && !innings3) {
    return NextResponse.json({
      ok: false,
      tied: true,
      resultText,
      message: "Match is tied. Start a Super Over to break the tie.",
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const i of [innings1, innings2, innings3, innings4]) {
      if (i) await tx.innings.update({ where: { id: i.id }, data: { isClosed: true } });
    }
    await tx.match.update({
      where: { id: params.id },
      data: { status: "COMPLETED", winnerTeamId, resultText },
    });
  });

  // Once the match is over, sign the scorer out so the next match
  // start (or any subsequent scoring action) goes through the
  // credential popup again.
  const res = NextResponse.json({ ok: true, resultText });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
