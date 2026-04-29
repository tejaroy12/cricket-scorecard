import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "hc_session";

function getSecret(): string {
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(username: string): string {
  const issued = Date.now().toString();
  const payload = `${username}:${issued}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [username, issued, sig] = parts;
    const expected = sign(`${username}:${issued}`);
    if (expected !== sig) return null;
    // Optional: 7-day expiry
    const issuedAt = Number(issued);
    if (!Number.isFinite(issuedAt)) return null;
    if (Date.now() - issuedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return username;
  } catch {
    return null;
  }
}

export function getCurrentAdmin(): string | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/**
 * The /admin panel itself is intentionally open — anyone can browse
 * teams, players, leaderboard, etc. The only places that need real
 * admin credentials are:
 *
 *   1. Deleting a match (handled by the password-confirm dialog on
 *      the matches list).
 *   2. Scoring a live or scheduled match (gated by `isScorer()`).
 *
 * Both pull credentials from a popup on the matches list and re-use
 * the existing 7-day signed admin session cookie.
 */
export function isAuthenticated(): boolean {
  return true;
}

/**
 * Whether the current request belongs to a signed-in admin who is
 * allowed to record balls / change a match's state. Used by the
 * scoring console + every mutation endpoint under /api/innings/* and
 * /api/matches/[id]/* that touches scoring state.
 */
export function isScorer(): boolean {
  return getCurrentAdmin() !== null;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
