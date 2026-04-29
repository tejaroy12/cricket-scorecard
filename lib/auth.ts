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
 * Admin authentication is currently DISABLED for everything except the
 * password-confirm dialog on destructive actions (e.g. deleting a match).
 *
 * Anyone can open `/admin`, edit teams/players, and score matches. The
 * delete-match endpoint still asks for `ADMIN_USERNAME` / `ADMIN_PASSWORD`
 * inside its own dialog, so audit-worthy actions stay gated.
 *
 * To turn auth back on, replace the body with:
 *   return getCurrentAdmin() !== null;
 */
export function isAuthenticated(): boolean {
  return true;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
