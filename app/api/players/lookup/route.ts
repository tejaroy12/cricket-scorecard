import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PLAYER_SESSION_COOKIE,
  normalizePhone,
} from "@/lib/playerSession";

/**
 * Public "claim my profile" lookup.
 *
 * Body: { phone: string; name?: string }
 *
 * Matches a Player by phone (last 10 digits). If the same phone is used by
 * more than one player (rare — e.g. shared family number) we narrow with
 * the optional `name` token-match; otherwise we just take the most recent
 * record. On success, sets a 30-day cookie pinning this browser to that
 * player so subsequent "Profile" clicks go straight to /players/<id>.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const name = String(body.name || "").trim();
  const rawPhone = String(body.phone || "").trim();
  const phone = normalizePhone(rawPhone);

  if (phone.length < 10) {
    return NextResponse.json(
      {
        error: "Please enter a valid 10-digit phone number.",
      },
      { status: 400 },
    );
  }

  const candidates = await prisma.player.findMany({
    where: {
      phone: { not: null },
    },
    include: { team: { select: { id: true, name: true } } },
  });

  let matches = candidates.filter(
    (p) => normalizePhone(p.phone || "") === phone,
  );

  // If the same phone is on multiple records and the caller provided a
  // name hint, narrow further. Otherwise we always pick the latest match.
  if (matches.length > 1 && name) {
    const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
    const narrowed = matches.filter((p) => {
      const storedName = p.name.toLowerCase();
      return tokens.every((t) => storedName.includes(t));
    });
    if (narrowed.length > 0) matches = narrowed;
  }

  if (matches.length === 0) {
    return NextResponse.json(
      {
        error:
          "We couldn't find a player with that phone number. If you're new, register first to claim your profile.",
        registerUrl: "/register",
      },
      { status: 404 },
    );
  }

  // Multiple matches (e.g. two siblings sharing a phone) — pick the most
  // recently created record as a sensible default.
  const player = matches.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];

  const res = NextResponse.json({
    id: player.id,
    name: player.name,
    role: player.role,
    team: player.team ? { id: player.team.id, name: player.team.name } : null,
    profileUrl: `/players/${player.id}`,
  });
  res.cookies.set(PLAYER_SESSION_COOKIE, player.id, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
