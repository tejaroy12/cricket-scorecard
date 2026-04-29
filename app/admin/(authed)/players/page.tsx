import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { PlayersTable } from "./PlayersTable";
import { AddPlayerForm, type AddPlayerInput } from "./AddPlayerForm";

export const dynamic = "force-dynamic";

const FLASH_COOKIE = "hc_flash";

function setFlash(message: string, kind: "ok" | "err" = "ok") {
  cookies().set(FLASH_COOKIE, JSON.stringify({ message, kind }), {
    path: "/admin/players",
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
    cookies().set(FLASH_COOKIE, "", { path: "/admin/players", maxAge: 0 });
    return parsed;
  } catch {
    return null;
  }
}

async function createPlayer(
  input: AddPlayerInput,
): Promise<{ ok: boolean; error?: string }> {
  "use server";
  const name = input.name.trim();
  const phone = input.phone.trim();
  const phoneDigits = phone.replace(/\D/g, "");

  if (!name) return { ok: false, error: "Player name is required." };
  if (phoneDigits.length < 10)
    return { ok: false, error: "Phone number must be at least 10 digits." };

  const teamId = input.teamId || null;
  const jersey =
    input.jerseyNumber !== null && Number.isFinite(input.jerseyNumber)
      ? Math.max(0, Math.min(999, Math.trunc(input.jerseyNumber)))
      : null;

  try {
    await prisma.player.create({
      data: {
        name,
        teamId,
        role: input.role || "BATTER",
        battingStyle: input.battingStyle || "RHB",
        bowlingStyle: input.bowlingStyle?.trim() || null,
        phone,
        jerseyNumber: jersey,
      },
    });
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Could not add player." };
  }

  revalidatePath("/admin/players");
  revalidatePath("/players");
  if (teamId) revalidatePath(`/teams/${teamId}`);
  return { ok: true };
}

async function deletePlayer(formData: FormData) {
  "use server";
  const { isAuthenticated } = await import("@/lib/auth");
  if (!isAuthenticated()) throw new Error("Unauthorized");

  const id = String(formData.get("id") || "");
  if (!id) return;

  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) {
    setFlash("Player not found.", "err");
    revalidatePath("/admin/players");
    return;
  }

  // Block deletion if player has any match history (preserves league records).
  const [batting, bowling, asStriker, asNonStriker, asBowler, asDismissed] =
    await Promise.all([
      prisma.battingEntry.count({ where: { playerId: id } }),
      prisma.bowlingEntry.count({ where: { playerId: id } }),
      prisma.ball.count({ where: { strikerId: id } }),
      prisma.ball.count({ where: { nonStrikerId: id } }),
      prisma.ball.count({ where: { bowlerId: id } }),
      prisma.ball.count({ where: { dismissedPlayerId: id } }),
    ]);

  const hasHistory =
    batting + bowling + asStriker + asNonStriker + asBowler + asDismissed > 0;

  if (hasHistory) {
    setFlash(
      `Can't delete "${player.name}" — they have match history. Remove or reset their matches first to preserve league records.`,
      "err",
    );
    revalidatePath("/admin/players");
    return;
  }

  await prisma.player.delete({ where: { id } });
  setFlash(`Deleted "${player.name}".`);
  revalidatePath("/admin/players");
  revalidatePath("/players");
  if (player.teamId) revalidatePath(`/teams/${player.teamId}`);
}

export default async function AdminPlayersPage() {
  const flash = readFlash();
  const [players, teams] = await Promise.all([
    prisma.player.findMany({
      orderBy: { name: "asc" },
      include: {
        team: true,
        _count: {
          select: {
            battingEntries: true,
            bowlingEntries: true,
          },
        },
      },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Players</h1>
        <p className="text-sm text-slate-500">Add players to teams.</p>
      </div>

      {flash && <FlashBanner flash={flash} />}

      <AddPlayerForm
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        action={createPlayer}
      />

      <PlayersTable
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          jerseyNumber: p.jerseyNumber,
          role: p.role,
          battingStyle: p.battingStyle,
          team: p.team ? { id: p.team.id, name: p.team.name } : null,
          battingHistoryCount: p._count.battingEntries,
          bowlingHistoryCount: p._count.bowlingEntries,
        }))}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        deleteAction={deletePlayer}
      />
    </div>
  );
}

function FlashBanner({
  flash,
}: {
  flash: { message: string; kind: "ok" | "err" };
}) {
  const cls =
    flash.kind === "err"
      ? "bg-red-50 text-red-800 ring-red-100"
      : "bg-emerald-50 text-emerald-800 ring-emerald-100";
  return (
    <div className={"rounded-md px-4 py-3 text-sm ring-1 " + cls}>
      {flash.message}
    </div>
  );
}
