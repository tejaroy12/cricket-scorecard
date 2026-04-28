import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import Link from "next/link";
import { PlayersTable } from "./PlayersTable";

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

async function createPlayer(formData: FormData) {
  "use server";
  const { isAuthenticated } = await import("@/lib/auth");
  if (!isAuthenticated()) throw new Error("Unauthorized");

  const name = String(formData.get("name") || "").trim();
  const teamId = String(formData.get("teamId") || "");
  const role = String(formData.get("role") || "BATTER");
  const battingStyle = String(formData.get("battingStyle") || "RHB");
  const bowlingStyle = String(formData.get("bowlingStyle") || "").trim();
  const jerseyNumberRaw = String(formData.get("jerseyNumber") || "").trim();
  const jerseyNumber = jerseyNumberRaw ? Number(jerseyNumberRaw) : null;

  if (!name || !teamId) return;
  await prisma.player.create({
    data: {
      name,
      teamId,
      role,
      battingStyle,
      bowlingStyle: bowlingStyle || null,
      jerseyNumber: jerseyNumber && Number.isFinite(jerseyNumber) ? jerseyNumber : null,
    },
  });
  setFlash(`Added "${name}".`);
  revalidatePath("/admin/players");
  revalidatePath("/players");
  revalidatePath(`/teams/${teamId}`);
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
  revalidatePath(`/teams/${player.teamId}`);
}

export default async function AdminPlayersPage() {
  const flash = readFlash();
  const [players, teams] = await Promise.all([
    prisma.player.findMany({
      orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
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

      {teams.length === 0 ? (
        <div className="card p-6 text-sm text-slate-600">
          You need to create a team first.{" "}
          <Link href="/admin/teams" className="font-medium text-hitachi hover:underline">
            Create a team
          </Link>
        </div>
      ) : (
        <form action={createPlayer} className="card space-y-4 p-5">
          <h2 className="text-base font-semibold text-slate-900">Add player</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" name="name" required placeholder="Virat Kumar" />
            </div>
            <div>
              <label className="label">Team</label>
              <select className="input" name="teamId" required defaultValue="">
                <option value="" disabled>Select team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Role</label>
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
              <label className="label">Bowling style</label>
              <input className="input" name="bowlingStyle" placeholder="e.g. Right-arm fast" />
            </div>
            <div>
              <label className="label">Jersey #</label>
              <input className="input" name="jerseyNumber" type="number" min={0} max={999} />
            </div>
          </div>
          <button type="submit" className="btn-primary">Add player</button>
        </form>
      )}

      <PlayersTable
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          jerseyNumber: p.jerseyNumber,
          role: p.role,
          battingStyle: p.battingStyle,
          team: { id: p.team.id, name: p.team.name },
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
