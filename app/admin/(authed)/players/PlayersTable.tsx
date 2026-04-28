"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Team = { id: string; name: string };
type PlayerRow = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  role: string;
  battingStyle: string;
  team: Team;
  battingHistoryCount: number;
  bowlingHistoryCount: number;
};

export function PlayersTable({
  players,
  teams,
  deleteAction,
}: {
  players: PlayerRow[];
  teams: Team[];
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (teamFilter && p.team.id !== teamFilter) return false;
      if (roleFilter && p.role !== roleFilter) return false;
      if (!q) return true;
      const hay =
        `${p.name} ${p.team.name} ${p.role} ${p.battingStyle} ${p.jerseyNumber ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [players, search, teamFilter, roleFilter]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="label">Search</label>
            <input
              className="input"
              placeholder="Search by player, team, role, jersey #…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sm:w-48">
            <label className="label">Team</label>
            <select
              className="input"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:w-44">
            <label className="label">Role</label>
            <select
              className="input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All roles</option>
              <option value="BATTER">Batter</option>
              <option value="BOWLER">Bowler</option>
              <option value="ALL_ROUNDER">All-rounder</option>
              <option value="WICKET_KEEPER">Wicket-keeper</option>
            </select>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {filtered.length} of {players.length} player
          {players.length === 1 ? "" : "s"}
        </div>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Player</th>
            <th className="px-5 py-3">Team</th>
            <th className="px-5 py-3">Role</th>
            <th className="px-5 py-3">Bat</th>
            <th className="px-5 py-3">History</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 table-row-hover">
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                {players.length === 0
                  ? "No players yet."
                  : "No players match the current filters."}
              </td>
            </tr>
          )}
          {filtered.map((p) => {
            const hasHistory =
              p.battingHistoryCount + p.bowlingHistoryCount > 0;
            return (
              <tr key={p.id}>
                <td className="px-5 py-3">
                  <Link
                    href={`/players/${p.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {p.name}
                  </Link>
                  {p.jerseyNumber != null && (
                    <span className="ml-2 text-xs text-slate-500">
                      #{p.jerseyNumber}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-700">{p.team.name}</td>
                <td className="px-5 py-3 text-slate-700">
                  {p.role.replace("_", "-").toLowerCase()}
                </td>
                <td className="px-5 py-3 text-slate-700">{p.battingStyle}</td>
                <td className="px-5 py-3">
                  {hasHistory ? (
                    <span className="pill bg-blue-50 text-blue-700">
                      {p.battingHistoryCount} bat ·{" "}
                      {p.bowlingHistoryCount} bowl
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Link
                      href={`/admin/players/${p.id}/edit`}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      title="Edit player"
                    >
                      Edit
                    </Link>
                    <form action={deleteAction} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        title={
                          hasHistory
                            ? "This player has match history and cannot be deleted."
                            : "Delete player"
                        }
                        className={
                          hasHistory
                            ? "rounded-md px-2 py-1 text-xs font-medium text-slate-400 cursor-not-allowed"
                            : "rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        }
                        disabled={hasHistory}
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
