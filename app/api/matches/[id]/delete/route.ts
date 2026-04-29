import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { recordAndNotify } from "@/lib/notify";

/**
 * Re-authenticate the admin before deleting a match. Even an authenticated
 * session must re-enter the admin password to confirm a destructive action.
 *
 * Body: { username, password }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "hitachi@123";
  if (body.username !== expectedUser || body.password !== expectedPass) {
    return NextResponse.json(
      { error: "Wrong admin credentials." },
      { status: 401 },
    );
  }

  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: { team1: true, team2: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  await prisma.match.delete({ where: { id: params.id } });

  revalidatePath("/admin/matches");
  revalidatePath("/matches");
  revalidatePath("/");

  await recordAndNotify({
    kind: "MATCH_DELETED",
    title: "Match deleted",
    body: `${match.team1.name} vs ${match.team2.name} (${match.venue}, ${match.oversPerSide} ov) was deleted.`,
    metadata: {
      matchId: match.id,
      team1: match.team1.name,
      team2: match.team2.name,
      venue: match.venue,
      oversPerSide: match.oversPerSide,
      status: match.status,
      matchDate: match.matchDate,
    },
  });

  return NextResponse.json({ ok: true });
}
