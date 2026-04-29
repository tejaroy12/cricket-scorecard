import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";

/**
 * Tells the client whether the current visitor is signed in as an
 * admin (i.e. has a valid `hc_session` cookie). Used by the
 * "Score live" / scoring console gates so we can skip the credential
 * popup when an admin is already authenticated.
 */
export async function GET() {
  const admin = getCurrentAdmin();
  return NextResponse.json({ admin });
}
