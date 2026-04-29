"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { LineupPicker, RolesMap, RolesEditor } from "../../LineupPicker";

type Team = { id: string; name: string };
type Player = {
  id: string;
  name: string;
  role: string;
  battingStyle: string;
  jerseyNumber: number | null;
  phone: string | null;
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
export type RosterEntry = {
  playerId: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isWicketKeeper: boolean;
};
type Input = {
  team1Id: string;
  team2Id: string;
  venue: string;
  oversPerSide: number;
  matchDate: string;
  team1Roster: RosterEntry[];
  team2Roster: RosterEntry[];
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
  initialTeam1Roster,
  initialTeam2Roster,
  teamsLocked,
  updateAction,
}: {
  match: MatchInfo;
  teams: Team[];
  players: Player[];
  initialTeam1Roster: RosterEntry[];
  initialTeam2Roster: RosterEntry[];
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
  const [team1PlayerIds, setTeam1PlayerIds] = useState<string[]>(
    initialTeam1Roster.map((r) => r.playerId),
  );
  const [team2PlayerIds, setTeam2PlayerIds] = useState<string[]>(
    initialTeam2Roster.map((r) => r.playerId),
  );
  const [team1Roles, setTeam1Roles] = useState<RolesMap>(() =>
    rosterToRoles(initialTeam1Roster),
  );
  const [team2Roles, setTeam2Roles] = useState<RolesMap>(() =>
    rosterToRoles(initialTeam2Roster),
  );

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function clearRolesFor(side: 1 | 2, playerId: string) {
    if (side === 1) {
      setTeam1Roles((cur) => {
        const c = { ...cur };
        delete c[playerId];
        return c;
      });
    } else {
      setTeam2Roles((cur) => {
        const c = { ...cur };
        delete c[playerId];
        return c;
      });
    }
  }

  function togglePlayer(side: 1 | 2, playerId: string) {
    if (side === 1) {
      setTeam1PlayerIds((cur) => {
        if (cur.includes(playerId)) {
          clearRolesFor(1, playerId);
          return cur.filter((x) => x !== playerId);
        }
        setTeam2PlayerIds((c2) => c2.filter((x) => x !== playerId));
        clearRolesFor(2, playerId);
        return [...cur, playerId];
      });
    } else {
      setTeam2PlayerIds((cur) => {
        if (cur.includes(playerId)) {
          clearRolesFor(2, playerId);
          return cur.filter((x) => x !== playerId);
        }
        setTeam1PlayerIds((c1) => c1.filter((x) => x !== playerId));
        clearRolesFor(1, playerId);
        return [...cur, playerId];
      });
    }
  }

  const team1Selected = useMemo(
    () => new Set(team1PlayerIds),
    [team1PlayerIds],
  );
  const team2Selected = useMemo(
    () => new Set(team2PlayerIds),
    [team2PlayerIds],
  );

  function buildRoster(ids: string[], roles: RolesMap): RosterEntry[] {
    return ids.map((pid) => ({
      playerId: pid,
      isCaptain: !!roles[pid]?.isCaptain,
      isViceCaptain: !!roles[pid]?.isViceCaptain,
      isWicketKeeper: !!roles[pid]?.isWicketKeeper,
    }));
  }

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
        team1Roster: buildRoster(team1PlayerIds, team1Roles),
        team2Roster: buildRoster(team2PlayerIds, team2Roles),
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
        <LineupPicker
          title={teams.find((t) => t.id === team1Id)?.name ?? "Team 1"}
          subtitle="Side 1 lineup. Search by name or phone."
          players={players}
          selectedIds={team1PlayerIds}
          otherSet={team2Selected}
          roles={team1Roles}
          onToggle={(id) => togglePlayer(1, id)}
          onRolesChange={setTeam1Roles}
        />
        <LineupPicker
          title={teams.find((t) => t.id === team2Id)?.name ?? "Team 2"}
          subtitle="Side 2 lineup. Search by name or phone."
          players={players}
          selectedIds={team2PlayerIds}
          otherSet={team1Selected}
          roles={team2Roles}
          onToggle={(id) => togglePlayer(2, id)}
          onRolesChange={setTeam2Roles}
        />
      </div>

      {(team1PlayerIds.length > 0 || team2PlayerIds.length > 0) && (
        <div className="card space-y-5 p-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Captain, Vice-Captain & Wicket-Keeper
            </h3>
            <p className="text-xs text-slate-500">
              Tag one captain, one vice-captain, and one keeper per side.
              You can re-assign these any time.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <RolesEditor
              title={teams.find((t) => t.id === team1Id)?.name ?? "Team 1"}
              players={players}
              selectedIds={team1PlayerIds}
              roles={team1Roles}
              onRolesChange={setTeam1Roles}
            />
            <RolesEditor
              title={teams.find((t) => t.id === team2Id)?.name ?? "Team 2"}
              players={players}
              selectedIds={team2PlayerIds}
              roles={team2Roles}
              onRolesChange={setTeam2Roles}
            />
          </div>
        </div>
      )}

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
          {pending ? <Spinner label="Saving…" /> : "Save changes"}
        </button>
        <div className="text-xs text-slate-500">
          Side 1: <b>{team1PlayerIds.length}</b> · Side 2:{" "}
          <b>{team2PlayerIds.length}</b>
        </div>
      </div>
    </div>
  );
}

function rosterToRoles(roster: RosterEntry[]): RolesMap {
  const out: RolesMap = {};
  for (const r of roster) {
    out[r.playerId] = {
      isCaptain: r.isCaptain,
      isViceCaptain: r.isViceCaptain,
      isWicketKeeper: r.isWicketKeeper,
    };
  }
  return out;
}
