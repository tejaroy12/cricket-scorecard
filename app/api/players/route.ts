import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

/**
 * Admin-only lookup used by the roster manager. Returns a small payload of
 * players keyed for quick search.
 */
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const players = await prisma.player.findMany({
    orderBy: { name: "asc" },
    include: { team: { select: { id: true, name: true } } },
  });
  return NextResponse.json(
    players.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      jerseyNumber: p.jerseyNumber,
      phone: p.phone,
      team: p.team ? { id: p.team.id, name: p.team.name } : null,
    })),
  );
}
