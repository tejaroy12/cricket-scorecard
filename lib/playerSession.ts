import { cookies } from "next/headers";
import { prisma } from "./prisma";

/**
 * Lightweight "Profile" identity for public visitors.
 *
 * Anyone who registered (or was added by an admin) with a phone number can
 * "claim" their profile by entering name + phone on the home page popup.
 * We just persist the matched player's id in a 30-day cookie — there's no
 * password, since the data here is read-only public stats.
 */
export const PLAYER_SESSION_COOKIE = "hc_player_id";

export function getCurrentPlayerId(): string | null {
  return cookies().get(PLAYER_SESSION_COOKIE)?.value || null;
}

export async function getCurrentPlayer() {
  const id = getCurrentPlayerId();
  if (!id) return null;
  return prisma.player.findUnique({
    where: { id },
    include: { team: true },
  });
}

/**
 * Phone matching is intentionally fuzzy: we strip every non-digit and
 * compare the trailing 10 digits, so `+91 98765 43210`, `09876543210`, and
 * `9876543210` all collide on the same record.
 */
export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
