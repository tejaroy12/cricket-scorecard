import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [teams, players, matches, live] = await Promise.all([
    prisma.team.count(),
    prisma.player.count(),
    prisma.match.count(),
    prisma.match.count({ where: { status: "LIVE" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Manage teams, players and live scoring.
          </p>
        </div>
        <Link href="/admin/matches/new" className="btn-primary">
          + New Match
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Teams" value={teams} href="/admin/teams" />
        <Tile label="Players" value={players} href="/admin/players" />
        <Tile label="Matches" value={matches} href="/admin/matches" />
        <Tile label="Live now" value={live} href="/admin/matches" highlight={live > 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActionCard
          title="Add a team"
          desc="Register a new department/division team."
          href="/admin/teams"
        />
        <ActionCard
          title="Add a player"
          desc="Add a player to an existing team."
          href="/admin/players"
        />
        <ActionCard
          title="Create a match"
          desc="Schedule a fixture between two teams."
          href="/admin/matches/new"
        />
        <ActionCard
          title="Score live"
          desc="Open a live match and update ball-by-ball."
          href="/admin/matches"
        />
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  href,
  highlight,
}: {
  label: string;
  value: number;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "card p-5 hover:shadow-lg transition-shadow " +
        (highlight ? "ring-2 ring-hitachi/40" : "")
      }
    >
      <div className={"text-3xl font-black tabular-nums " + (highlight ? "text-hitachi" : "text-slate-900")}>
        {value}
      </div>
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </div>
    </Link>
  );
}

function ActionCard({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link href={href} className="card flex items-center gap-3 p-4 hover:shadow-lg">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-hitachi/10 text-hitachi">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </div>
      <div className="flex-1">
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
    </Link>
  );
}
