import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayerId } from "@/lib/playerSession";

/**
 * Returns the player record currently pinned to this browser via the
 * `hc_player_id` cookie, or null if nobody has claimed a profile yet.
 */
export async function GET() {
  const id = getCurrentPlayerId();
  if (!id) return NextResponse.json({ player: null });

  const player = await prisma.player.findUnique({
    where: { id },
    include: { team: { select: { id: true, name: true } } },
  });
  if (!player) return NextResponse.json({ player: null });

  return NextResponse.json({
    player: {
      id: player.id,
      name: player.name,
      phone: player.phone,
      role: player.role,
      team: player.team ? { id: player.team.id, name: player.team.name } : null,
      profileUrl: `/players/${player.id}`,
    },
  });
}
