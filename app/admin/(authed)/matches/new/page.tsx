import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function createMatch(formData: FormData) {
  "use server";
  const { isAuthenticated } = await import("@/lib/auth");
  if (!isAuthenticated()) throw new Error("Unauthorized");

  const team1Id = String(formData.get("team1Id") || "");
  const team2Id = String(formData.get("team2Id") || "");
  const venue = String(formData.get("venue") || "Hitachi Sports Ground").trim() || "Hitachi Sports Ground";
  const oversPerSide = Number(formData.get("oversPerSide") || 20);
  const matchDateStr = String(formData.get("matchDate") || "");
  const matchDate = matchDateStr ? new Date(matchDateStr) : new Date();

  if (!team1Id || !team2Id || team1Id === team2Id) {
    throw new Error("Pick two different teams");
  }

  const m = await prisma.match.create({
    data: {
      team1Id,
      team2Id,
      venue,
      oversPerSide: Number.isFinite(oversPerSide) ? oversPerSide : 20,
      matchDate,
      status: "SCHEDULED",
    },
  });

  redirect(`/admin/matches/${m.id}`);
}

export default async function NewMatchPage() {
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New match</h1>
        <p className="text-sm text-slate-500">Schedule a fixture between two teams.</p>
      </div>

      {teams.length < 2 ? (
        <div className="card p-6 text-sm text-slate-600">
          You need at least two teams to create a match.
        </div>
      ) : (
        <form action={createMatch} className="card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Team 1</label>
              <select className="input" name="team1Id" required defaultValue="">
                <option value="" disabled>Select team…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Team 2</label>
              <select className="input" name="team2Id" required defaultValue="">
                <option value="" disabled>Select team…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="label">Venue</label>
              <input className="input" name="venue" defaultValue="Hitachi Sports Ground" />
            </div>
            <div>
              <label className="label">Overs / side</label>
              <input className="input" name="oversPerSide" type="number" min={1} max={50} defaultValue={20} />
            </div>
          </div>
          <div>
            <label className="label">Date & time</label>
            <input
              className="input"
              type="datetime-local"
              name="matchDate"
              defaultValue={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <button type="submit" className="btn-primary">Create match</button>
        </form>
      )}
    </div>
  );
}
