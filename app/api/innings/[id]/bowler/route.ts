import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

/**
 * Change the current bowler (typically at the start of a new over).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const bowlerId = body?.bowlerId;
  if (!bowlerId) return NextResponse.json({ error: "bowlerId required" }, { status: 400 });

  const existing = await prisma.bowlingEntry.findUnique({
    where: { inningsId_playerId: { inningsId: params.id, playerId: bowlerId } },
  });
  if (!existing) {
    await prisma.bowlingEntry.create({
      data: { inningsId: params.id, playerId: bowlerId },
    });
  }

  return NextResponse.json({ ok: true });
}
