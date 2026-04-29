import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

/**
 * Super Over endpoint.
 *
 * - When called the first time on a tied match it creates innings #3 with the
 *   chase side (team that batted second) batting again — 1 over / 2 wickets.
 * - When called again after innings #3 closes it creates innings #4 (the
 *   other side) — also 1 over / 2 wickets.
 * - If both super-over innings already exist it returns an error so the
 *   admin uses the regular Complete Match flow instead.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      innings: { orderBy: { inningsNumber: "asc" } },
    },
  });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const innings1 = match.innings.find((i) => i.inningsNumber === 1);
  const innings2 = match.innings.find((i) => i.inningsNumber === 2);
  const innings3 = match.innings.find((i) => i.inningsNumber === 3);
  const innings4 = match.innings.find((i) => i.inningsNumber === 4);

  if (!innings1 || !innings2) {
    return NextResponse.json(
      { error: "Both regular innings must finish before a Super Over." },
      { status: 400 },
    );
  }

  if (!innings3) {
    // Innings 3: the side that batted in innings 2 bats first in the super
    // over. (This matches the user's flow — chase side first, then defenders.)
    const created = await prisma.innings.create({
      data: {
        matchId: match.id,
        inningsNumber: 3,
        battingTeamId: innings2.battingTeamId,
        bowlingTeamId: innings2.bowlingTeamId,
        isSuperOver: true,
        maxOvers: 1,
        maxWickets: 2,
      },
    });
    await prisma.match.update({
      where: { id: match.id },
      data: { status: "LIVE" },
    });
    return NextResponse.json({ ok: true, inningsId: created.id, side: 3 });
  }

  if (!innings4) {
    if (!innings3.isClosed) {
      return NextResponse.json(
        { error: "Finish the first super-over innings first." },
        { status: 400 },
      );
    }
    const created = await prisma.innings.create({
      data: {
        matchId: match.id,
        inningsNumber: 4,
        battingTeamId: innings3.bowlingTeamId,
        bowlingTeamId: innings3.battingTeamId,
        isSuperOver: true,
        maxOvers: 1,
        maxWickets: 2,
      },
    });
    return NextResponse.json({ ok: true, inningsId: created.id, side: 4 });
  }

  return NextResponse.json(
    { error: "A full super over is already in progress or has finished." },
    { status: 400 },
  );
}
