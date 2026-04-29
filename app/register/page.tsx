import { prisma } from "@/lib/prisma";
import { recordAndNotify } from "@/lib/notify";
import { RegisterForm, type RegisterInput } from "./RegisterForm";

export const dynamic = "force-dynamic";

type Result = { ok: true; redirectTo: string } | { ok: false; error: string };

async function registerPlayerAction(input: RegisterInput): Promise<Result> {
  "use server";

  const name = input.name.trim();
  const phone = input.phone.trim();
  const phoneDigits = phone.replace(/\D/g, "");

  if (!name) return { ok: false, error: "Please enter your full name." };
  if (phoneDigits.length < 10) {
    return {
      ok: false,
      error: "Please enter a valid phone number (at least 10 digits).",
    };
  }
  if (
    !["BATTER", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"].includes(input.role)
  ) {
    return { ok: false, error: "Pick a valid playing role." };
  }

  const jersey =
    input.jerseyNumber !== null && Number.isFinite(input.jerseyNumber)
      ? Math.max(0, Math.min(999, Math.trunc(input.jerseyNumber)))
      : null;

  let player;
  try {
    player = await prisma.player.create({
      data: {
        name,
        phone,
        employeeId: input.employeeId.trim() || null,
        role: input.role,
        battingStyle: input.battingStyle || "RHB",
        bowlingStyle: input.bowlingStyle.trim() || null,
        jerseyNumber: jersey,
        selfRegistered: true,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return {
        ok: false,
        error:
          "That employee ID is already registered. Reach out to the admin if this is you.",
      };
    }
    return {
      ok: false,
      error: `Could not register: ${e?.message ?? "unknown error"}`,
    };
  }

  try {
    await recordAndNotify({
      kind: "PLAYER_REGISTERED",
      title: "New player registered",
      body: `${name} (${input.role.toLowerCase()}, ${phone}) just joined the league.`,
      metadata: { playerId: player.id },
    });
  } catch {}

  return { ok: true, redirectTo: `/players/${player.id}?welcome=1` };
}

export default function RegisterPage() {
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

      <RegisterForm action={registerPlayerAction} />
    </div>
  );
}
