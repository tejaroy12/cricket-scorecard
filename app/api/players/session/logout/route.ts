import { NextResponse } from "next/server";
import { PLAYER_SESSION_COOKIE } from "@/lib/playerSession";

/**
 * Forget the player currently pinned to this browser. Used by the "Switch
 * profile" link on the Profile dialog.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PLAYER_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
