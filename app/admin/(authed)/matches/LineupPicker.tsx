"use client";

import { useMemo, useState } from "react";

export type RolesMap = Record<
  string,
  { isCaptain?: boolean; isViceCaptain?: boolean; isWicketKeeper?: boolean }
>;

type Player = {
  id: string;
  name: string;
  role: string;
  battingStyle: string;
  jerseyNumber: number | null;
  phone: string | null;
  team: { id: string; name: string } | null;
};

function phoneMatchesQuery(phone: string | null | undefined, q: string) {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length >= 3 && digits.includes(qDigits)) return true;
  return phone.toLowerCase().includes(q);
}

/**
 * Reusable lineup picker shared between the new-match and edit-match flows.
 *
 * - Search by name, team, role OR phone number
 * - First ~4 players visible; the rest scrolls
 * - Per-row Captain / Vice-Captain / Wicket-Keeper pills (one of each per
 *   side at most; toggling one off when set elsewhere)
 */
export function LineupPicker({
  title,
  subtitle,
  players,
  selectedIds,
  otherSet,
  roles,
  onToggle,
  onRolesChange,
}: {
  title: string;
  subtitle: string;
  players: Player[];
  selectedIds: string[];
  otherSet: Set<string>;
  roles: RolesMap;
  onToggle: (playerId: string) => void;
  onRolesChange: (next: RolesMap) => void;
}) {
  const [search, setSearch] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = players;
    if (showSelectedOnly) list = list.filter((p) => selectedSet.has(p.id));
    if (q) {
      list = list.filter((p) => {
        const hay = `${p.name} ${p.team?.name ?? "free agent"} ${p.role} ${p.jerseyNumber ?? ""}`.toLowerCase();
        if (hay.includes(q)) return true;
        return phoneMatchesQuery(p.phone, q);
      });
    }
    return list.slice().sort((a, b) => {
      const sa = selectedSet.has(a.id) ? 0 : 1;
      const sb = selectedSet.has(b.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });
  }, [players, search, selectedSet, showSelectedOnly]);

  function setRole(
    playerId: string,
    key: "isCaptain" | "isViceCaptain" | "isWicketKeeper",
  ) {
    const cur = roles[playerId] ?? {};
    const next: RolesMap = { ...roles };
    const turningOn = !cur[key];
    if (turningOn) {
      // Captain & vice-captain are exclusive across the side.
      if (key === "isCaptain" || key === "isViceCaptain") {
        for (const id of Object.keys(next)) {
          if (id !== playerId && next[id]?.[key]) {
            next[id] = { ...next[id], [key]: false };
          }
        }
      }
      // A captain cannot also be vice-captain on the same player.
      const updated: RolesMap[string] = { ...cur, [key]: true };
      if (key === "isCaptain") updated.isViceCaptain = false;
      if (key === "isViceCaptain") updated.isCaptain = false;
      next[playerId] = updated;
    } else {
      next[playerId] = { ...cur, [key]: false };
    }
    onRolesChange(next);
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <span className="rounded-full bg-hitachi/10 px-2.5 py-0.5 text-xs font-bold text-hitachi">
            {selectedIds.length}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="Search name, team, role, or phone…"
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

      {/*
       * ~4 rows visible (~3.75rem each), the rest scrolls. The fixed height
       * keeps the new-match page tidy when many players are loaded.
       */}
      <div className="max-h-[15rem] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            {players.length === 0
              ? "No players in the database yet. Add some at /admin/players first."
              : "No players match the current filter."}
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {filtered.map((p) => {
            const isSelected = selectedSet.has(p.id);
            const onOtherSide = otherSet.has(p.id);
            const r = roles[p.id] ?? {};
            return (
              <li key={p.id}>
                <div
                  className={
                    "flex items-center gap-3 px-5 py-2.5 " +
                    (isSelected ? "bg-hitachi/5" : "")
                  }
                >
                  <button
                    type="button"
                    onClick={() => onToggle(p.id)}
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
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
                        {p.phone ? <span> · {p.phone}</span> : null}
                      </div>
                    </div>
                    {onOtherSide && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                        Other side
                      </span>
                    )}
                  </button>
                  {isSelected && (
                    <div className="flex shrink-0 items-center gap-1">
                      <RolePill
                        active={!!r.isCaptain}
                        title="Captain"
                        onClick={() => setRole(p.id, "isCaptain")}
                      >
                        C
                      </RolePill>
                      <RolePill
                        active={!!r.isViceCaptain}
                        title="Vice-Captain"
                        onClick={() => setRole(p.id, "isViceCaptain")}
                      >
                        VC
                      </RolePill>
                      <RolePill
                        active={!!r.isWicketKeeper}
                        title="Wicket-Keeper"
                        onClick={() => setRole(p.id, "isWicketKeeper")}
                      >
                        WK
                      </RolePill>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function RolePill({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 transition " +
        (active
          ? "bg-hitachi text-white ring-hitachi"
          : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50")
      }
    >
      {children}
    </button>
  );
}

/**
 * Standalone "set captain / VC / WK" editor used as a second step under the
 * lineup picker. Lists only the already-selected players for one side.
 */
export function RolesEditor({
  title,
  players,
  selectedIds,
  roles,
  onRolesChange,
}: {
  title: string;
  players: Player[];
  selectedIds: string[];
  roles: RolesMap;
  onRolesChange: (next: RolesMap) => void;
}) {
  const playersById = useMemo(
    () => new Map(players.map((p) => [p.id, p] as const)),
    [players],
  );
  const picked = selectedIds
    .map((id) => playersById.get(id))
    .filter((p): p is Player => !!p);

  function setRole(
    playerId: string,
    key: "isCaptain" | "isViceCaptain" | "isWicketKeeper",
  ) {
    const cur = roles[playerId] ?? {};
    const next: RolesMap = { ...roles };
    const turningOn = !cur[key];
    if (turningOn) {
      if (key === "isCaptain" || key === "isViceCaptain") {
        for (const id of Object.keys(next)) {
          if (id !== playerId && next[id]?.[key]) {
            next[id] = { ...next[id], [key]: false };
          }
        }
      }
      const updated: RolesMap[string] = { ...cur, [key]: true };
      if (key === "isCaptain") updated.isViceCaptain = false;
      if (key === "isViceCaptain") updated.isCaptain = false;
      next[playerId] = updated;
    } else {
      next[playerId] = { ...cur, [key]: false };
    }
    onRolesChange(next);
  }

  const captain = picked.find((p) => roles[p.id]?.isCaptain) ?? null;
  const vc = picked.find((p) => roles[p.id]?.isViceCaptain) ?? null;
  const wk = picked.find((p) => roles[p.id]?.isWicketKeeper) ?? null;

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        <span className="rounded-full bg-hitachi/10 px-2.5 py-0.5 text-xs font-bold text-hitachi">
          {picked.length}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        <div>
          Captain
          <div className="mt-0.5 truncate text-xs font-medium normal-case tracking-normal text-slate-900">
            {captain?.name ?? "—"}
          </div>
        </div>
        <div>
          Vice
          <div className="mt-0.5 truncate text-xs font-medium normal-case tracking-normal text-slate-900">
            {vc?.name ?? "—"}
          </div>
        </div>
        <div>
          Keeper
          <div className="mt-0.5 truncate text-xs font-medium normal-case tracking-normal text-slate-900">
            {wk?.name ?? "—"}
          </div>
        </div>
      </div>
      {picked.length === 0 ? (
        <div className="mt-3 text-xs italic text-slate-400">
          Pick the lineup above first.
        </div>
      ) : (
        <ul className="mt-3 max-h-[15rem] divide-y divide-slate-100 overflow-y-auto">
          {picked.map((p) => {
            const r = roles[p.id] ?? {};
            return (
              <li
                key={p.id}
                className="flex items-center gap-2 py-1.5 text-sm"
              >
                <div className="min-w-0 flex-1 truncate text-slate-900">
                  {p.name}
                  {p.jerseyNumber != null && (
                    <span className="ml-1 text-xs text-slate-400">
                      #{p.jerseyNumber}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <RolePill
                    active={!!r.isCaptain}
                    title="Captain"
                    onClick={() => setRole(p.id, "isCaptain")}
                  >
                    C
                  </RolePill>
                  <RolePill
                    active={!!r.isViceCaptain}
                    title="Vice-Captain"
                    onClick={() => setRole(p.id, "isViceCaptain")}
                  >
                    VC
                  </RolePill>
                  <RolePill
                    active={!!r.isWicketKeeper}
                    title="Wicket-Keeper"
                    onClick={() => setRole(p.id, "isWicketKeeper")}
                  >
                    WK
                  </RolePill>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
