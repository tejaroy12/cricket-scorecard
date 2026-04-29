import { NextRequest, NextResponse } from "next/server";
import { applyBall } from "@/lib/scoring";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const innings = await prisma.innings.findUnique({ where: { id: params.id } });
  if (!innings) return NextResponse.json({ error: "Innings not found" }, { status: 404 });

  // Resolve striker / non-striker / bowler from current crease state if not provided
  const onCrease = await prisma.battingEntry.findMany({
    where: { inningsId: params.id, isOnCrease: true },
  });
  const striker = onCrease.find((b) => b.isStriker);
  const nonStriker = onCrease.find((b) => !b.isStriker);

  if (!striker || !nonStriker) {
    return NextResponse.json(
      { error: "Set opening batters before scoring" },
      { status: 400 },
    );
  }

  const bowlerId =
    body.bowlerId ||
    (
      await prisma.bowlingEntry.findFirst({
        where: { inningsId: params.id },
        orderBy: { balls: "desc" }, // last bowler with most balls
      })
    )?.playerId;
  if (!bowlerId) {
    return NextResponse.json({ error: "Set the bowler" }, { status: 400 });
  }

  try {
    await applyBall({
      inningsId: params.id,
      strikerId: striker.playerId,
      nonStrikerId: nonStriker.playerId,
      bowlerId,
      runs: Number(body.runs ?? 0),
      extras: Number(body.extras ?? 0),
      extraType: body.extraType ?? null,
      isWicket: Boolean(body.isWicket),
      wicketType: body.wicketType ?? null,
      dismissedPlayerId: body.dismissedPlayerId ?? null,
      fielderId: body.fielderId ?? null,
      newBatterId: body.newBatterId ?? null,
      commentary: body.commentary ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}
