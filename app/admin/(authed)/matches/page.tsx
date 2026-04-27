import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const FLASH_COOKIE = "hc_flash";

function setFlash(message: string, kind: "ok" | "err" = "ok") {
  cookies().set(FLASH_COOKIE, JSON.stringify({ message, kind }), {
    path: "/admin/matches",
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
    cookies().set(FLASH_COOKIE, "", { path: "/admin/matches", maxAge: 0 });
    return parsed;
  } catch {
    return null;
  }
}

async function deleteMatch(formData: FormData) {
  "use server";
  const { isAuthenticated } = await import("@/lib/auth");
  if (!isAuthenticated()) throw new Error("Unauthorized");
  const id = String(formData.get("id") || "");
  if (!id) return;
  try {
    await prisma.match.delete({ where: { id } });
    setFlash("Match deleted.");
  } catch (e: any) {
    setFlash(`Could not delete match: ${e?.message ?? "unknown error"}`, "err");
  }
  revalidatePath("/admin/matches");
  revalidatePath("/matches");
  revalidatePath("/");
}

export default async function AdminMatchesPage() {
  const flash = readFlash();
  const matches = await prisma.match.findMany({
    orderBy: [{ status: "asc" }, { matchDate: "desc" }],
    include: { team1: true, team2: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Matches</h1>
          <p className="text-sm text-slate-500">Create and manage matches.</p>
        </div>
        <Link href="/admin/matches/new" className="btn-primary">+ New Match</Link>
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

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Match</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 table-row-hover">
            {matches.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                  No matches yet.{" "}
                  <Link href="/admin/matches/new" className="font-medium text-hitachi hover:underline">
                    Create one.
                  </Link>
                </td>
              </tr>
            )}
            {matches.map((m) => (
              <tr key={m.id}>
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-900">
                    {m.team1.name} vs {m.team2.name}
                  </div>
                  <div className="text-xs text-slate-500">{m.venue} · {m.oversPerSide} overs</div>
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {new Date(m.matchDate).toLocaleString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </td>
                <td className="px-5 py-3">
                  <StatusPill status={m.status} />
                </td>
                <td className="px-5 py-3 text-right space-x-2">
                  <Link href={`/admin/matches/${m.id}`} className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800">
                    {m.status === "LIVE" ? "Score live" : m.status === "SCHEDULED" ? "Manage" : "View"}
                  </Link>
                  <form action={deleteMatch} className="inline">
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "LIVE") return <span className="pill-live">Live</span>;
  if (status === "COMPLETED") return <span className="pill-completed">Completed</span>;
  if (status === "ABANDONED") return <span className="pill bg-amber-50 text-amber-700">Abandoned</span>;
  return <span className="pill-scheduled">Scheduled</span>;
}
