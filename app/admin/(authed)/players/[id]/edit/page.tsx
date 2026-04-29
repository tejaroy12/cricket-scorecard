import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

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

function setEditFlash(
  playerId: string,
  message: string,
  kind: "ok" | "err" = "ok",
) {
  cookies().set(FLASH_COOKIE, JSON.stringify({ message, kind }), {
    path: `/admin/players/${playerId}/edit`,
    maxAge: 30,
    httpOnly: false,
    sameSite: "lax",
  });
}

function readEditFlash(
  playerId: string,
): { message: string; kind: "ok" | "err" } | null {
  const c = cookies().get(FLASH_COOKIE);
  if (!c) return null;
  try {
    const parsed = JSON.parse(c.value);
    cookies().set(FLASH_COOKIE, "", {
      path: `/admin/players/${playerId}/edit`,
      maxAge: 0,
    });
    return parsed;
  } catch {
    return null;
  }
}

async function updatePlayer(formData: FormData) {
  "use server";
  const { isAuthenticated } = await import("@/lib/auth");
  if (!isAuthenticated()) throw new Error("Unauthorized");

  const id = String(formData.get("id") || "");
  if (!id) return;

  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) {
    setFlash("Player not found.", "err");
    redirect("/admin/players");
  }

  const name = String(formData.get("name") || "").trim();
  const teamIdRaw = String(formData.get("teamId") || "").trim();
  const teamId = teamIdRaw || null;
  const role = String(formData.get("role") || "BATTER");
  const battingStyle = String(formData.get("battingStyle") || "RHB");
  const bowlingStyleRaw = String(formData.get("bowlingStyle") || "").trim();
  const phoneRaw = String(formData.get("phone") || "").trim();
  const jerseyRaw = String(formData.get("jerseyNumber") || "").trim();
  const employeeIdRaw = String(formData.get("employeeId") || "").trim();

  if (!name) {
    setEditFlash(id, "Player name is required.", "err");
    redirect(`/admin/players/${id}/edit`);
  }

  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      setEditFlash(id, "Selected team no longer exists.", "err");
      redirect(`/admin/players/${id}/edit`);
    }
  }

  const jerseyParsed = jerseyRaw ? Number(jerseyRaw) : null;
  const jerseyNumber =
    jerseyParsed !== null && Number.isFinite(jerseyParsed)
      ? Math.max(0, Math.min(999, Math.trunc(jerseyParsed)))
      : null;

  // Phone uniqueness (only if a phone was provided).
  if (phoneRaw) {
    const trailing = phoneRaw.replace(/\D/g, "").slice(-10);
    if (trailing.length < 10) {
      setEditFlash(id, "Phone number must be at least 10 digits.", "err");
      redirect(`/admin/players/${id}/edit`);
    }
    const others = await prisma.player.findMany({
      where: { phone: { not: null }, NOT: { id } },
      select: { id: true, name: true, phone: true },
    });
    const collision = others.find(
      (p) => (p.phone ?? "").replace(/\D/g, "").slice(-10) === trailing,
    );
    if (collision) {
      setEditFlash(
        id,
        `That phone number is already used by "${collision.name}". Please enter the correct number.`,
        "err",
      );
      redirect(`/admin/players/${id}/edit`);
    }
  }

  try {
    await prisma.player.update({
      where: { id },
      data: {
        name,
        teamId,
        role,
        battingStyle,
        bowlingStyle: bowlingStyleRaw || null,
        phone: phoneRaw || null,
        jerseyNumber,
        employeeId: employeeIdRaw || null,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      setEditFlash(
        id,
        "That employee ID is already used by another player.",
        "err",
      );
      redirect(`/admin/players/${id}/edit`);
    }
    setEditFlash(id, `Update failed: ${e?.message ?? "unknown error"}`, "err");
    redirect(`/admin/players/${id}/edit`);
  }

  setFlash(`Updated "${name}".`);
  revalidatePath("/admin/players");
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  if (teamId) revalidatePath(`/teams/${teamId}`);
  if (player!.teamId && player!.teamId !== teamId) {
    revalidatePath(`/teams/${player!.teamId}`);
  }
  redirect("/admin/players");
}

export default async function EditPlayerPage({
  params,
}: {
  params: { id: string };
}) {
  const [player, teams] = await Promise.all([
    prisma.player.findUnique({
      where: { id: params.id },
      include: { team: true },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!player) notFound();

  const flash = readEditFlash(player.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Edit player
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{player.name}</h1>
          <p className="text-sm text-slate-500">
            {player.team ? (
              <>
                Currently in{" "}
                <span className="font-medium text-slate-700">
                  {player.team.name}
                </span>
              </>
            ) : (
              <span className="italic">Free agent (no default team)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/players/${player.id}`} className="btn-ghost">
            View profile
          </Link>
          <Link href="/admin/players" className="btn-ghost">
            Back to list
          </Link>
        </div>
      </div>

      {flash && <FlashBanner flash={flash} />}

      <form action={updatePlayer} className="card space-y-4 p-5">
        <input type="hidden" name="id" value={player.id} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              name="name"
              required
              defaultValue={player.name}
            />
          </div>

          <div>
            <label className="label">Default team (optional)</label>
            <select
              className="input"
              name="teamId"
              defaultValue={player.teamId ?? ""}
            >
              <option value="">— Free agent —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Role</label>
            <select
              className="input"
              name="role"
              defaultValue={player.role}
            >
              <option value="BATTER">Batter</option>
              <option value="BOWLER">Bowler</option>
              <option value="ALL_ROUNDER">All-rounder</option>
              <option value="WICKET_KEEPER">Wicket-keeper</option>
            </select>
          </div>

          <div>
            <label className="label">Batting style</label>
            <select
              className="input"
              name="battingStyle"
              defaultValue={player.battingStyle}
            >
              <option value="RHB">Right-hand bat</option>
              <option value="LHB">Left-hand bat</option>
            </select>
          </div>

          <div>
            <label className="label">Bowling style</label>
            <input
              className="input"
              name="bowlingStyle"
              placeholder="e.g. Right-arm fast"
              defaultValue={player.bowlingStyle ?? ""}
            />
          </div>

          <div>
            <label className="label">Jersey #</label>
            <input
              className="input"
              name="jerseyNumber"
              type="number"
              min={0}
              max={999}
              defaultValue={player.jerseyNumber ?? ""}
            />
          </div>

          <div>
            <label className="label">Phone (optional)</label>
            <input
              className="input"
              name="phone"
              type="tel"
              placeholder="e.g. 9876543210"
              inputMode="numeric"
              pattern="[0-9 +()-]*"
              defaultValue={player.phone ?? ""}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Employee ID (optional)</label>
            <input
              className="input"
              name="employeeId"
              placeholder="e.g. HIT-12345"
              defaultValue={player.employeeId ?? ""}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button type="submit" className="btn-primary">
            Save changes
          </button>
          <Link href="/admin/players" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
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
