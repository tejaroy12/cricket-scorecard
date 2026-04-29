import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PLAYER_SESSION_COOKIE,
  normalizePhone,
} from "@/lib/playerSession";

/**
 * Public "claim my profile" lookup.
 *
 * Body: { name: string; phone: string }
 *
 * Matches a Player by phone (last 10 digits) AND name (case-insensitive,
 * partial).  On success, sets a 30-day cookie pinning this browser to that
 * player so subsequent "Profile" clicks go straight to /players/<id>.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const name = String(body.name || "").trim();
  const rawPhone = String(body.phone || "").trim();
  const phone = normalizePhone(rawPhone);

  if (!name || phone.length < 10) {
    return NextResponse.json(
      {
        error:
          "Please enter your full name and a 10-digit phone number to look up your profile.",
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

  const matches = candidates.filter((p) => {
    const stored = normalizePhone(p.phone || "");
    if (stored !== phone) return false;
    // Loose name compare: each input token must appear somewhere in the
    // stored name (so "Virat" matches "Virat Kumar" and vice versa).
    const storedName = p.name.toLowerCase();
    const inputTokens = name
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return inputTokens.every((t) => storedName.includes(t));
  });

  if (matches.length === 0) {
    return NextResponse.json(
      {
        error:
          "We couldn't find a player with that name and phone. If you're new, register first to claim your profile.",
        registerUrl: "/register",
      },
      { status: 404 },
    );
  }

  // Multiple matches (e.g. two siblings sharing a phone with similar names)
  // — pick the most recent active player as a sensible default.
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
