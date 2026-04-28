import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const FLASH_COOKIE = "hc_flash";

function setFlash(message: string, kind: "ok" | "err" = "ok") {
  cookies().set(FLASH_COOKIE, JSON.stringify({ message, kind }), {
    path: "/admin/teams",
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
    cookies().set(FLASH_COOKIE, "", { path: "/admin/teams", maxAge: 0 });
    return parsed;
  } catch {
    return null;
  }
}

async function createTeam(formData: FormData) {
  "use server";
  const { isAuthenticated } = await import("@/lib/auth");
  if (!isAuthenticated()) throw new Error("Unauthorized");

  const name = String(formData.get("name") || "").trim();
  const shortName = String(formData.get("shortName") || "").trim();
  const logoUrl = String(formData.get("logoUrl") || "").trim();
  if (!name) {
    setFlash("Team name is required.", "err");
    return;
  }
  try {
    await prisma.team.create({
      data: {
        name,
        shortName: shortName || name.slice(0, 3).toUpperCase(),
        logoUrl: logoUrl || null,
      },
    });
    setFlash(`Created team "${name}".`);
  } catch (e: any) {
    setFlash(
      e?.code === "P2002"
        ? `A team named "${name}" already exists.`
        : `Could not create team: ${e?.message ?? "unknown error"}`,
      "err",
    );
  }
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  revalidatePath("/");
}

async function deleteTeam(formData: FormData) {
  "use server";
  const { isAuthenticated } = await import("@/lib/auth");
  if (!isAuthenticated()) throw new Error("Unauthorized");
  const id = String(formData.get("id") || "");
  if (!id) return;

  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) {
    setFlash("Team not found.", "err");
    revalidatePath("/admin/teams");
    return;
  }

  // Block deletion if the team is referenced by any match.
  const matchCount = await prisma.match.count({
    where: { OR: [{ team1Id: id }, { team2Id: id }] },
  });
  if (matchCount > 0) {
    setFlash(
      `Can't delete "${team.name}" — they're part of ${matchCount} match${matchCount === 1 ? "" : "es"}. Delete those matches first to preserve league records.`,
      "err",
    );
    revalidatePath("/admin/teams");
    return;
  }

  // Also block if any player on this team has match history (their cascade
  // would otherwise fail at the DB level).
  const playerWithHistory = await prisma.player.findFirst({
    where: {
      teamId: id,
      OR: [
        { battingEntries: { some: {} } },
        { bowlingEntries: { some: {} } },
      ],
    },
    select: { id: true, name: true },
  });
  if (playerWithHistory) {
    setFlash(
      `Can't delete "${team.name}" — player "${playerWithHistory.name}" has match history.`,
      "err",
    );
    revalidatePath("/admin/teams");
    return;
  }

  await prisma.team.delete({ where: { id } });
  setFlash(`Deleted team "${team.name}".`);
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  revalidatePath("/");
}

export default async function AdminTeamsPage() {
  const flash = readFlash();
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          players: true,
          homeMatches: true,
          awayMatches: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Teams</h1>
        <p className="text-sm text-slate-500">Add or remove teams.</p>
      </div>

      {flash && <FlashBanner flash={flash} />}

      <form action={createTeam} className="card space-y-4 p-5">
        <h2 className="text-base font-semibold text-slate-900">Add a new team</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Team name</label>
            <input className="input" name="name" placeholder="Hitachi Tigers" required />
          </div>
          <div>
            <label className="label">Short code</label>
            <input className="input" name="shortName" placeholder="TIG" maxLength={5} />
          </div>
          <div>
            <label className="label">Logo URL (optional)</label>
            <input className="input" name="logoUrl" placeholder="https://..." />
          </div>
        </div>
        <button type="submit" className="btn-primary">Create team</button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Team</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Players</th>
                <th className="px-5 py-3">Matches</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 table-row-hover">
              {teams.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No teams yet. Create one above.
                  </td>
                </tr>
              )}
              {teams.map((t) => {
                const matches = t._count.homeMatches + t._count.awayMatches;
                const blocked = matches > 0;
                return (
                  <tr key={t.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
                          {(t.shortName || t.name).slice(0, 3).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{t.shortName}</td>
                    <td className="px-5 py-3 tabular-nums">{t._count.players}</td>
                    <td className="px-5 py-3 tabular-nums">{matches}</td>
                    <td className="px-5 py-3 text-right">
                      <form action={deleteTeam} className="inline">
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          title={
                            blocked
                              ? "This team is part of one or more matches and cannot be deleted."
                              : "Delete team"
                          }
                          className={
                            blocked
                              ? "rounded-md px-2 py-1 text-xs font-medium text-slate-400 cursor-not-allowed"
                              : "rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          }
                          disabled={blocked}
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
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
