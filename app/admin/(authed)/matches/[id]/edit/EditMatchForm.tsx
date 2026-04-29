"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Team = { id: string; name: string };
type Player = {
  id: string;
  name: string;
  role: string;
  battingStyle: string;
  jerseyNumber: number | null;
  team: { id: string; name: string } | null;
};
type MatchInfo = {
  id: string;
  team1Id: string;
  team2Id: string;
  venue: string;
  oversPerSide: number;
  matchDate: string;
};
type Input = {
  team1Id: string;
  team2Id: string;
  venue: string;
  oversPerSide: number;
  matchDate: string;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
};

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditMatchForm({
  match,
  teams,
  players,
  initialTeam1PlayerIds,
  initialTeam2PlayerIds,
  teamsLocked,
  updateAction,
}: {
  match: MatchInfo;
  teams: Team[];
  players: Player[];
  initialTeam1PlayerIds: string[];
  initialTeam2PlayerIds: string[];
  teamsLocked: boolean;
  updateAction: (input: Input) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [team1Id, setTeam1Id] = useState(match.team1Id);
  const [team2Id, setTeam2Id] = useState(match.team2Id);
  const [venue, setVenue] = useState(match.venue);
  const [oversPerSide, setOversPerSide] = useState<number>(match.oversPerSide);
  const [matchDate, setMatchDate] = useState<string>(
    toLocalDateTimeInput(match.matchDate),
  );
  const [team1PlayerIds, setTeam1PlayerIds] =
    useState<string[]>(initialTeam1PlayerIds);
  const [team2PlayerIds, setTeam2PlayerIds] =
    useState<string[]>(initialTeam2PlayerIds);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function togglePlayer(side: 1 | 2, playerId: string) {
    if (side === 1) {
      setTeam1PlayerIds((cur) => {
        if (cur.includes(playerId)) return cur.filter((x) => x !== playerId);
        setTeam2PlayerIds((c2) => c2.filter((x) => x !== playerId));
        return [...cur, playerId];
      });
    } else {
      setTeam2PlayerIds((cur) => {
        if (cur.includes(playerId)) return cur.filter((x) => x !== playerId);
        setTeam1PlayerIds((c1) => c1.filter((x) => x !== playerId));
        return [...cur, playerId];
      });
    }
  }

  const team1Selected = useMemo(() => new Set(team1PlayerIds), [team1PlayerIds]);
  const team2Selected = useMemo(() => new Set(team2PlayerIds), [team2PlayerIds]);

  function submit() {
    setError(null);
    setSuccess(null);
    if (!team1Id || !team2Id) {
      setError("Pick both teams.");
      return;
    }
    if (team1Id === team2Id) {
      setError("Team 1 and Team 2 must be different.");
      return;
    }
    startTransition(async () => {
      const res = await updateAction({
        team1Id,
        team2Id,
        venue: venue.trim() || "Hitachi Sports Ground",
        oversPerSide: Number.isFinite(oversPerSide) ? oversPerSide : 20,
        matchDate,
        team1PlayerIds,
        team2PlayerIds,
      });
      if (!res.ok) setError(res.error || "Could not save changes.");
      else {
        setSuccess("Match updated.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Team 1</label>
            <select
              className="input"
              value={team1Id}
              onChange={(e) => setTeam1Id(e.target.value)}
              disabled={teamsLocked}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id} disabled={t.id === team2Id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Team 2</label>
            <select
              className="input"
              value={team2Id}
              onChange={(e) => setTeam2Id(e.target.value)}
              disabled={teamsLocked}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id} disabled={t.id === team1Id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Venue</label>
            <input
              className="input"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Overs / side</label>
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              value={oversPerSide}
              onChange={(e) => setOversPerSide(Number(e.target.value || 0))}
            />
          </div>
        </div>
        <div>
          <label className="label">Date & time</label>
          <input
            className="input"
            type="datetime-local"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
          />
        </div>
        {teamsLocked && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
            Teams are locked because at least one ball has been bowled. You can
            still rename players in / out of either roster (anyone who has
            already batted or bowled is preserved automatically).
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RosterPicker
          title={teams.find((t) => t.id === team1Id)?.name ?? "Team 1"}
          subtitle="Side 1 lineup. Search and tap to add or remove."
          players={players}
          selectedSet={team1Selected}
          otherSet={team2Selected}
          onToggle={(id) => togglePlayer(1, id)}
        />
        <RosterPicker
          title={teams.find((t) => t.id === team2Id)?.name ?? "Team 2"}
          subtitle="Side 2 lineup. Search and tap to add or remove."
          players={players}
          selectedSet={team2Selected}
          otherSet={team1Selected}
          onToggle={(id) => togglePlayer(2, id)}
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
          {success}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <div className="text-xs text-slate-500">
          Side 1: <b>{team1PlayerIds.length}</b> · Side 2:{" "}
          <b>{team2PlayerIds.length}</b>
        </div>
      </div>
    </div>
  );
}

function RosterPicker({
  title,
  subtitle,
  players,
  selectedSet,
  otherSet,
  onToggle,
}: {
  title: string;
  subtitle: string;
  players: Player[];
  selectedSet: Set<string>;
  otherSet: Set<string>;
  onToggle: (playerId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = players;
    if (showSelectedOnly) list = list.filter((p) => selectedSet.has(p.id));
    if (q) {
      list = list.filter((p) => {
        const hay = `${p.name} ${p.team?.name ?? "free agent"} ${p.role} ${p.jerseyNumber ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list.slice().sort((a, b) => {
      const sa = selectedSet.has(a.id) ? 0 : 1;
      const sb = selectedSet.has(b.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });
  }, [players, search, selectedSet, showSelectedOnly]);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <span className="rounded-full bg-hitachi/10 px-2.5 py-0.5 text-xs font-bold text-hitachi">
            {selectedSet.size}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="Search by player name, team, role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowSelectedOnly((v) => !v)}
            className={
              "rounded-md px-3 py-2 text-xs font-medium ring-1 transition " +
              (showSelectedOnly
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")
            }
          >
            Selected
          </button>
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            {players.length === 0
              ? "No players yet — add some at /admin/players."
              : "No players match the current filter."}
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {filtered.map((p) => {
            const isSelected = selectedSet.has(p.id);
            const onOtherSide = otherSet.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onToggle(p.id)}
                  className={
                    "flex w-full items-center gap-3 px-5 py-2.5 text-left transition " +
                    (isSelected
                      ? "bg-hitachi/5 hover:bg-hitachi/10"
                      : "hover:bg-slate-50")
                  }
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="h-4 w-4 cursor-pointer accent-hitachi"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {p.name}
                      {p.jerseyNumber != null && (
                        <span className="ml-1 text-xs text-slate-400">
                          #{p.jerseyNumber}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {p.team?.name ?? "Free agent"} ·{" "}
                      {p.role.replace("_", "-").toLowerCase()} ·{" "}
                      {p.battingStyle}
                    </div>
                  </div>
                  {onOtherSide && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                      Other side
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
