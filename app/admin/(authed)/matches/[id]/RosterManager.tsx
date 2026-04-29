"use client";

import { useEffect, useMemo, useState } from "react";

type Player = { id: string; name: string; jerseyNumber?: number | null };
type MatchPlayer = { id: string; matchId: string; playerId: string; side: number; player: Player };
type Team = { id: string; name: string; players: Player[] };
type StateLike = {
  id: string;
  status: string;
  team1: Team;
  team2: Team;
  matchPlayers?: MatchPlayer[];
};

type Candidate = {
  id: string;
  name: string;
  role: string;
  jerseyNumber: number | null;
  team: { id: string; name: string } | null;
};

/**
 * Mid-match roster manager. Lets the admin add or drop players on either
 * side without disturbing scoring state. Players who have already batted /
 * bowled cannot be removed (server-side enforcement); the UI greys them out.
 */
export function RosterManager({
  state,
  onChanged,
}: {
  state: StateLike;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [search, setSearch] = useState("");
  const [pickerSide, setPickerSide] = useState<1 | 2>(1);

  const side1Players: Player[] = useMemo(() => {
    const fromMatch = (state.matchPlayers ?? [])
      .filter((mp) => mp.side === 1)
      .map((mp) => mp.player);
    return fromMatch.length > 0 ? fromMatch : state.team1.players;
  }, [state]);
  const side2Players: Player[] = useMemo(() => {
    const fromMatch = (state.matchPlayers ?? [])
      .filter((mp) => mp.side === 2)
      .map((mp) => mp.player);
    return fromMatch.length > 0 ? fromMatch : state.team2.players;
  }, [state]);

  useEffect(() => {
    if (!open || candidates !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/players", { cache: "no-store" });
        if (!r.ok) throw new Error("Failed to load players");
        const j = (await r.json()) as Candidate[];
        if (!cancelled) setCandidates(j);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to load players");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, candidates]);

  const onSidePlayerIds = useMemo(
    () => new Set([...side1Players, ...side2Players].map((p) => p.id)),
    [side1Players, side2Players],
  );

  const filteredCandidates = useMemo(() => {
    if (!candidates) return [];
    const q = search.trim().toLowerCase();
    return candidates
      .filter((c) => !onSidePlayerIds.has(c.id))
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.name} ${c.team?.name ?? "free agent"} ${c.role} ${c.jerseyNumber ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 30);
  }, [candidates, onSidePlayerIds, search]);

  async function add(playerId: string, side: 1 | 2) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/matches/${state.id}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", playerId, side }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not add player");
      setSearch("");
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(playerId: string) {
    if (!confirm("Drop this player from the match roster?")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/matches/${state.id}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", playerId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not remove player");
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-hitachi/10 text-hitachi">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M22 11h-6"/><path d="M19 8v6"/></svg>
          </span>
          <div>
            <div className="text-base font-bold text-slate-900">
              Manage match rosters
            </div>
            <div className="text-xs text-slate-500">
              Add or drop players from either side without stopping the match.
            </div>
          </div>
        </div>
        <span className="text-xs font-medium text-hitachi">
          {open ? "Hide" : "Open"}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-100 px-5 py-5">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <RosterColumn
              title={state.team1.name}
              countLabel="Side 1"
              players={side1Players}
              busy={busy}
              onRemove={remove}
            />
            <RosterColumn
              title={state.team2.name}
              countLabel="Side 2"
              players={side2Players}
              busy={busy}
              onRemove={remove}
            />
          </div>

          <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Add a player
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md ring-1 ring-slate-200">
                {([1, 2] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPickerSide(s)}
                    className={
                      "px-3 py-1.5 text-xs font-semibold transition " +
                      (pickerSide === s
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-700 hover:bg-slate-50")
                    }
                  >
                    {s === 1 ? state.team1.name : state.team2.name}
                  </button>
                ))}
              </div>
              <input
                className="input flex-1 min-w-[180px]"
                placeholder="Search by name, team, role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {candidates === null ? (
              <div className="mt-3 text-xs text-slate-500">
                Loading players…
              </div>
            ) : (
              <ul className="mt-3 max-h-[260px] divide-y divide-slate-100 overflow-y-auto rounded-md bg-white ring-1 ring-slate-100">
                {filteredCandidates.length === 0 && (
                  <li className="px-4 py-3 text-xs text-slate-500">
                    {search
                      ? "No players match your search."
                      : "All registered players are already on a side."}
                  </li>
                )}
                {filteredCandidates.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900">
                        {c.name}
                        {c.jerseyNumber != null && (
                          <span className="ml-1 text-xs text-slate-400">
                            #{c.jerseyNumber}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {c.team?.name ?? "Free agent"} ·{" "}
                        {c.role.replace("_", "-").toLowerCase()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => add(c.id, pickerSide)}
                      disabled={busy}
                      className="rounded-md bg-hitachi px-2.5 py-1 text-xs font-semibold text-white hover:bg-hitachi-dark disabled:opacity-50"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RosterColumn({
  title,
  countLabel,
  players,
  busy,
  onRemove,
}: {
  title: string;
  countLabel: string;
  players: Player[];
  busy: boolean;
  onRemove: (playerId: string) => void;
}) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {countLabel}
          </div>
          <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        </div>
        <span className="rounded-full bg-hitachi/10 px-2.5 py-0.5 text-xs font-bold text-hitachi">
          {players.length}
        </span>
      </div>
      {players.length === 0 ? (
        <div className="mt-3 text-xs italic text-slate-400">No players.</div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="truncate text-slate-900">
                {p.name}
                {p.jerseyNumber != null && (
                  <span className="ml-1 text-xs text-slate-400">
                    #{p.jerseyNumber}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                disabled={busy}
                className="rounded-md px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Drop
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
