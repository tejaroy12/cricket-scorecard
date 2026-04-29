import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { recordAndNotify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const FLASH_COOKIE = "hc_register_flash";

function setFlash(message: string, kind: "ok" | "err" = "ok") {
  cookies().set(FLASH_COOKIE, JSON.stringify({ message, kind }), {
    path: "/register",
    maxAge: 30,
    httpOnly: false,
    sameSite: "lax",
  });
}

function readFlash(): { message: string; kind: "ok" | "err" } | null {
  const c = cookies().get(FLASH_COOKIE);
  if (!c) return null;
  try {
    const parsed = JSON.parse(c.value);
    cookies().set(FLASH_COOKIE, "", { path: "/register", maxAge: 0 });
    return parsed;
  } catch {
    return null;
  }
}

async function registerPlayer(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const employeeIdRaw = String(formData.get("employeeId") || "").trim();
  const role = String(formData.get("role") || "BATTER");
  const battingStyle = String(formData.get("battingStyle") || "RHB");
  const bowlingStyleRaw = String(formData.get("bowlingStyle") || "").trim();
  const jerseyRaw = String(formData.get("jerseyNumber") || "").trim();

  if (!name) {
    setFlash("Please enter your full name.", "err");
    redirect("/register");
  }
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    setFlash("Please enter a valid phone number (at least 10 digits).", "err");
    redirect("/register");
  }
  if (!["BATTER", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"].includes(role)) {
    setFlash("Pick a valid playing role.", "err");
    redirect("/register");
  }

  const jerseyParsed = jerseyRaw ? Number(jerseyRaw) : null;
  const jerseyNumber =
    jerseyParsed !== null && Number.isFinite(jerseyParsed)
      ? Math.max(0, Math.min(999, Math.trunc(jerseyParsed)))
      : null;

  let player;
  try {
    player = await prisma.player.create({
      data: {
        name,
        phone,
        employeeId: employeeIdRaw || null,
        role,
        battingStyle,
        bowlingStyle: bowlingStyleRaw || null,
        jerseyNumber,
        selfRegistered: true,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      setFlash(
        "That employee ID is already registered. Reach out to the admin if this is you.",
        "err",
      );
      redirect("/register");
    }
    setFlash(`Could not register: ${e?.message ?? "unknown error"}`, "err");
    redirect("/register");
  }

  // Best-effort: also notify the league admin a new player joined.
  try {
    await recordAndNotify({
      kind: "PLAYER_REGISTERED",
      title: "New player registered",
      body: `${name} (${role.toLowerCase()}, ${phone}) just joined the league.`,
      metadata: { playerId: player!.id },
    });
  } catch {}

  redirect(`/players/${player!.id}?welcome=1`);
}

export default function RegisterPage() {
  const flash = readFlash();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-hitachi">
          Hitachi Cricket League
        </div>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          Join the league
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Add yourself to the player database in 30 seconds. Once you&apos;re
          in, captains can pick you for either side when they create a match —
          no admin approval needed.
        </p>
      </div>

      {flash && (
        <div
          className={
            "rounded-md px-4 py-3 text-sm ring-1 " +
            (flash.kind === "err"
              ? "bg-red-50 text-red-800 ring-red-100"
              : "bg-emerald-50 text-emerald-800 ring-emerald-100")
          }
        >
          {flash.message}
        </div>
      )}

      <form action={registerPlayer} className="card space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Full name *</label>
            <input
              className="input"
              name="name"
              required
              placeholder="e.g. Virat Kumar"
            />
          </div>
          <div>
            <label className="label">Phone *</label>
            <input
              className="input"
              name="phone"
              type="tel"
              required
              inputMode="numeric"
              pattern="[0-9 +()-]*"
              placeholder="9876543210"
            />
          </div>
          <div>
            <label className="label">Employee ID (optional)</label>
            <input
              className="input"
              name="employeeId"
              placeholder="e.g. HIT-12345"
            />
          </div>
          <div>
            <label className="label">Role *</label>
            <select className="input" name="role" defaultValue="BATTER">
              <option value="BATTER">Batter</option>
              <option value="BOWLER">Bowler</option>
              <option value="ALL_ROUNDER">All-rounder</option>
              <option value="WICKET_KEEPER">Wicket-keeper</option>
            </select>
          </div>
          <div>
            <label className="label">Batting style</label>
            <select className="input" name="battingStyle" defaultValue="RHB">
              <option value="RHB">Right-hand bat</option>
              <option value="LHB">Left-hand bat</option>
            </select>
          </div>
          <div>
            <label className="label">Bowling style (optional)</label>
            <input
              className="input"
              name="bowlingStyle"
              placeholder="e.g. Right-arm fast"
            />
          </div>
          <div>
            <label className="label">Jersey # (optional)</label>
            <input
              className="input"
              name="jerseyNumber"
              type="number"
              min={0}
              max={999}
              placeholder="e.g. 18"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="submit" className="btn-primary">
            Register me
          </button>
          <Link href="/players" className="btn-ghost">
            Browse players first
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          By registering you agree your name and contact details may be shown
          to other league members for match scheduling.
        </p>
      </form>
    </div>
  );
}
