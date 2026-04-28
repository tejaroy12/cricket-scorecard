"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Player = { id: string; name: string; jerseyNumber?: number | null; teamId?: string | null };
type Team = { id: string; name: string; shortName: string; players: Player[] };
type MatchPlayer = { id: string; matchId: string; playerId: string; side: number; player: Player };
type BattingEntry = {
  id: string;
  playerId: string;
  player: Player;
  battingOrder: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  isOnCrease: boolean;
  isStriker: boolean;
  strikeRate: number;
};
type BowlingEntry = {
  id: string;
  playerId: string;
  player: Player;
  balls: number;
  runsConceded: number;
  wickets: number;
  oversText: string;
  economy: number;
};
type Ball = {
  id: string;
  sequence: number;
  overNumber: number;
  ballInOver: number;
  runs: number;
  extras: number;
  extraType: string | null;
  isLegal: boolean;
  isWicket: boolean;
  wicketType: string | null;
  striker: Player;
  bowler: Player;
  dismissedPlayer: Player | null;
};
type Innings = {
  id: string;
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  battingTeam: Team;
  bowlingTeam: Team;
  totalRuns: number;
  totalWickets: number;
  totalBalls: number;
  extras: number;
  isClosed: boolean;
  oversText: string;
  runRate: number;
  battingEntries: BattingEntry[];
  bowlingEntries: BowlingEntry[];
  balls: Ball[];
};
type Award = {
  playerId: string;
  playerName: string;
  teamName: string;
  headline: string;
  caption: string;
};
type MatchAwards = {
  bestBatter: Award | null;
  bestBowler: Award | null;
  manOfTheMatch: (Award & { score: number }) | null;
};
type MatchState = {
  id: string;
  status: string;
  venue: string;
  oversPerSide: number;
  matchDate: string;
  team1: Team;
  team2: Team;
  tossWinner: Team | null;
  tossDecision: string | null;
  innings: Innings[];
  currentInningsId: string | null;
  resultText: string | null;
  awards?: MatchAwards;
  matchPlayers?: MatchPlayer[];
};

// Returns the lineup for a given side (1 or 2). Prefers per-match roster
// (MatchPlayer) when present; falls back to the legacy team.players list so
// matches created before the roster picker still work.
function getRosterForTeam(state: MatchState, teamId: string): Player[] {
  const side = state.team1.id === teamId ? 1 : state.team2.id === teamId ? 2 : 0;
  const fromMatch = (state.matchPlayers ?? [])
    .filter((mp) => mp.side === side)
    .map((mp) => mp.player);
  if (fromMatch.length > 0) return fromMatch;
  if (state.team1.id === teamId) return state.team1.players;
  if (state.team2.id === teamId) return state.team2.players;
  return [];
}

export default function ScoringConsole({ initial }: { initial: MatchState }) {
  const router = useRouter();
  const [state, setState] = useState<MatchState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/matches/${state.id}/state`, { cache: "no-store" });
    if (r.ok) setState(await r.json());
  }, [state.id]);

  useEffect(() => {
    if (state.status !== "LIVE") return;
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [state.status, refresh]);

  const currentInnings = useMemo(
    () => state.innings.find((i) => i.id === state.currentInningsId) || null,
    [state.innings, state.currentInningsId],
  );

  const call = useCallback(
    async (url: string, body?: any) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Request failed");
        }
        await refresh();
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Failed");
      } finally {
        setBusy(false);
      }
    },
    [refresh, router],
  );

  // Auto-transition: when innings 1 closes (all out / overs done / chase chased)
  // and there's no innings 2 yet, automatically start the 2nd innings after a
  // brief pause so the user can see the "innings over" message.
  useEffect(() => {
    if (state.status !== "LIVE") return;
    if (!currentInnings) return;
    if (!currentInnings.isClosed) return;
    if (currentInnings.inningsNumber !== 1) return;
    if (state.innings.some((i) => i.inningsNumber === 2)) return;

    setAutoMessage("Innings 1 complete — starting 2nd innings…");
    const t = setTimeout(() => {
      call(`/api/matches/${state.id}/start-second-innings`).finally(() =>
        setAutoMessage(null),
      );
    }, 2000);
    return () => clearTimeout(t);
  }, [state, currentInnings, call]);

  return (
    <div className="space-y-6">
      <Header state={state} />

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      )}

      {autoMessage && (
        <div className="rounded-md bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
          {autoMessage}
        </div>
      )}

      {state.status === "SCHEDULED" && (
        <TossPanel state={state} onSubmit={(b) => call(`/api/matches/${state.id}/toss`, b)} busy={busy} />
      )}

      {state.status === "LIVE" && currentInnings && (
        <>
          <InningsScorecard innings={currentInnings} />
          <ScoringPanel
            key={currentInnings.id}
            state={state}
            innings={currentInnings}
            busy={busy}
            onSetOpeners={(b) => call(`/api/innings/${currentInnings.id}/openers`, b)}
            onSetBowler={(bowlerId) => call(`/api/innings/${currentInnings.id}/bowler`, { bowlerId })}
            onBall={(b) => call(`/api/innings/${currentInnings.id}/ball`, b)}
            onUndo={() => call(`/api/innings/${currentInnings.id}/undo`)}
            onStartSecondInnings={() => call(`/api/matches/${state.id}/start-second-innings`)}
            onComplete={() => call(`/api/matches/${state.id}/complete`)}
          />
          <RecentBalls innings={currentInnings} />
        </>
      )}

      {state.innings.length > 0 && (
        <FullScorecardSection
          innings={state.innings}
          awards={state.awards}
          matchStatus={state.status}
          defaultOpen={state.status === "COMPLETED"}
        />
      )}

      {state.status === "COMPLETED" && state.resultText && (
        <div className="card border-l-4 border-emerald-500 p-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Result</div>
          <div className="mt-1 text-lg font-bold text-slate-900">{state.resultText}</div>
        </div>
      )}
    </div>
  );
}

function Header({ state }: { state: MatchState }) {
  const innings1 = state.innings.find((i) => i.inningsNumber === 1);
  const innings2 = state.innings.find((i) => i.inningsNumber === 2);
  return (
    <div className="card overflow-hidden">
      <div className="hitachi-hero px-6 py-5 text-white">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/70">
            {state.venue} · {state.oversPerSide} overs
          </div>
          {state.status === "LIVE" && <span className="pill-live">Live</span>}
          {state.status === "COMPLETED" && (
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-200">
              Completed
            </span>
          )}
          {state.status === "SCHEDULED" && (
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white/80">
              Scheduled
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          {state.team1.name} <span className="text-white/60">vs</span> {state.team2.name}
        </h1>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ScoreBlock team={state.team1.name} innings={innings1?.battingTeamId === state.team1.id ? innings1 : innings2?.battingTeamId === state.team1.id ? innings2 : undefined} />
          <ScoreBlock team={state.team2.name} innings={innings1?.battingTeamId === state.team2.id ? innings1 : innings2?.battingTeamId === state.team2.id ? innings2 : undefined} />
        </div>
        {state.tossWinner && (
          <div className="mt-3 text-xs text-white/70">
            Toss: {state.tossWinner.name} chose to {state.tossDecision === "BAT" ? "bat" : "bowl"}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBlock({ team, innings }: { team: string; innings?: Innings }) {
  return (
    <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur">
      <div className="text-xs font-semibold uppercase tracking-wider text-white/70">{team}</div>
      {innings ? (
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-black tabular-nums">
            {innings.totalRuns}
            <span className="text-base font-bold text-white/70">/{innings.totalWickets}</span>
          </div>
          <div className="text-xs tabular-nums text-white/70">({innings.oversText} ov)</div>
        </div>
      ) : (
        <div className="text-sm text-white/60">Yet to bat</div>
      )}
    </div>
  );
}

function TossPanel({ state, onSubmit, busy }: { state: MatchState; onSubmit: (b: any) => void; busy: boolean }) {
  const [tossWinnerId, setWinner] = useState<string>(state.team1.id);
  const [tossDecision, setDecision] = useState<"BAT" | "BOWL">("BAT");

  const team1Players = getRosterForTeam(state, state.team1.id);
  const team2Players = getRosterForTeam(state, state.team2.id);
  const lacking =
    team1Players.length < 2 || team2Players.length < 2;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-slate-900">Toss</h2>
      <p className="text-sm text-slate-500">Set the toss winner and their decision to start the match.</p>

      {lacking && (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-100">
          Each team needs at least 2 players to start scoring.
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Toss winner</label>
          <select className="input" value={tossWinnerId} onChange={(e) => setWinner(e.target.value)}>
            <option value={state.team1.id}>{state.team1.name}</option>
            <option value={state.team2.id}>{state.team2.name}</option>
          </select>
        </div>
        <div>
          <label className="label">Decision</label>
          <select className="input" value={tossDecision} onChange={(e) => setDecision(e.target.value as any)}>
            <option value="BAT">Chose to bat</option>
            <option value="BOWL">Chose to bowl</option>
          </select>
        </div>
      </div>
      <button
        disabled={busy || lacking}
        onClick={() => onSubmit({ tossWinnerId, tossDecision })}
        className="btn-primary mt-4"
      >
        Start match
      </button>
    </div>
  );
}

function InningsScorecard({ innings }: { innings: Innings }) {
  const striker = innings.battingEntries.find((b) => b.isOnCrease && b.isStriker);
  const nonStriker = innings.battingEntries.find((b) => b.isOnCrease && !b.isStriker);
  const bowler = innings.bowlingEntries
    .slice()
    .sort((a, b) => b.balls - a.balls)[0];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {innings.battingTeam.name} batting
          </h3>
          <div className="text-right">
            <div className="text-3xl font-black tabular-nums text-hitachi">
              {innings.totalRuns}
              <span className="text-xl text-slate-400">/{innings.totalWickets}</span>
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              ({innings.oversText}) · RR {innings.runRate}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <BatterLine entry={striker} label="*" />
          <BatterLine entry={nonStriker} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-bold text-slate-900">Bowling</h3>
        {bowler ? (
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-900">{bowler.player.name}</div>
              <div className="tabular-nums text-slate-700">
                {bowler.oversText} ov · {bowler.runsConceded}/{bowler.wickets}
              </div>
            </div>
            <div className="text-xs text-slate-500">Econ {bowler.economy || "-"}</div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-500">No bowler set yet.</div>
        )}
      </div>
    </div>
  );
}

function BatterLine({ entry, label }: { entry?: BattingEntry; label?: string }) {
  if (!entry) return <div className="text-slate-400">—</div>;
  return (
    <div className="flex items-center justify-between">
      <div className="font-medium text-slate-900">
        {entry.player.name}
        {label && <span className="ml-1 text-hitachi">{label}</span>}
      </div>
      <div className="tabular-nums text-slate-700">
        {entry.runs} ({entry.balls})
        <span className="ml-2 text-xs text-slate-500">
          4s:{entry.fours} 6s:{entry.sixes} SR:{entry.strikeRate || "-"}
        </span>
      </div>
    </div>
  );
}

function ScoringPanel({
  state,
  innings,
  busy,
  onSetOpeners,
  onSetBowler,
  onBall,
  onUndo,
  onStartSecondInnings,
  onComplete,
}: {
  state: MatchState;
  innings: Innings;
  busy: boolean;
  onSetOpeners: (b: { strikerId: string; nonStrikerId: string; bowlerId: string }) => void;
  onSetBowler: (bowlerId: string) => void;
  onBall: (b: any) => void;
  onUndo: () => void;
  onStartSecondInnings: () => void;
  onComplete: () => void;
}) {
  const battingTeamPlayers = getRosterForTeam(state, innings.battingTeamId);
  const bowlingTeamPlayers = getRosterForTeam(state, innings.bowlingTeamId);

  const onCrease = innings.battingEntries.filter((b) => b.isOnCrease);
  const striker = onCrease.find((b) => b.isStriker);
  const nonStriker = onCrease.find((b) => !b.isStriker);

  const currentBowler = innings.bowlingEntries.slice().sort((a, b) => b.balls - a.balls)[0];

  // End of innings: closed flag from server, all out (team-size aware), all overs bowled,
  // OR (2nd innings) chase target reached.
  const teamSize = battingTeamPlayers.length;
  const maxOversReached = innings.totalBalls >= state.oversPerSide * 6;
  const allOut = teamSize > 0 && innings.totalWickets >= Math.max(1, teamSize - 1);
  const inningsOver = innings.isClosed || maxOversReached || allOut;

  // Only show the openers form for a brand-new innings, never for one that has
  // already ended (otherwise after all-out the UI would ask for new openers).
  const needsOpeners = !inningsOver && onCrease.length < 2;

  const isFirstInnings = innings.inningsNumber === 1;

  return (
    <div className="card space-y-5 p-5">
      {needsOpeners ? (
        <OpenersForm
          batters={battingTeamPlayers}
          bowlers={bowlingTeamPlayers}
          busy={busy}
          onSubmit={onSetOpeners}
        />
      ) : (
        <>
          <BowlerSwitcher
            bowlers={bowlingTeamPlayers}
            current={currentBowler?.playerId}
            busy={busy}
            onChange={onSetBowler}
          />

          {!inningsOver ? (
            <BallEntry
              striker={striker?.player}
              nonStriker={nonStriker?.player}
              bowler={currentBowler?.player}
              battingTeamPlayers={battingTeamPlayers}
              dismissedPlayerIds={innings.battingEntries
                .filter((b) => b.isOut)
                .map((b) => b.playerId)}
              busy={busy}
              onBall={onBall}
              onUndo={onUndo}
            />
          ) : (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-100">
              Innings complete: {innings.totalRuns}/{innings.totalWickets} in {innings.oversText} overs
              {allOut ? " (all out)" : maxOversReached ? " (overs complete)" : ""}.
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {isFirstInnings && (
              <button
                disabled={busy}
                onClick={onStartSecondInnings}
                className="btn-dark"
              >
                End innings & start 2nd innings
              </button>
            )}
            <button
              disabled={busy}
              onClick={onComplete}
              className="btn-primary"
            >
              Complete match
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function OpenersForm({
  batters,
  bowlers,
  busy,
  onSubmit,
}: {
  batters: Player[];
  bowlers: Player[];
  busy: boolean;
  onSubmit: (b: { strikerId: string; nonStrikerId: string; bowlerId: string }) => void;
}) {
  const [strikerId, setStriker] = useState<string>("");
  const [nonStrikerId, setNonStriker] = useState<string>("");
  const [bowlerId, setBowler] = useState<string>("");

  const valid = strikerId && nonStrikerId && bowlerId && strikerId !== nonStrikerId;

  return (
    <div>
      <h3 className="text-base font-bold text-slate-900">Set openers</h3>
      <p className="text-sm text-slate-500">Pick the two opening batters and the opening bowler.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Striker</label>
          <select className="input" value={strikerId} onChange={(e) => setStriker(e.target.value)}>
            <option value="">Select…</option>
            {batters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Non-striker</label>
          <select className="input" value={nonStrikerId} onChange={(e) => setNonStriker(e.target.value)}>
            <option value="">Select…</option>
            {batters.filter((p) => p.id !== strikerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Opening bowler</label>
          <select className="input" value={bowlerId} onChange={(e) => setBowler(e.target.value)}>
            <option value="">Select…</option>
            {bowlers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <button
        disabled={!valid || busy}
        onClick={() => onSubmit({ strikerId, nonStrikerId, bowlerId })}
        className="btn-primary mt-4"
      >
        Start innings
      </button>
    </div>
  );
}

function BowlerSwitcher({
  bowlers,
  current,
  busy,
  onChange,
}: {
  bowlers: Player[];
  current: string | undefined;
  busy: boolean;
  onChange: (id: string) => void;
}) {
  const [val, setVal] = useState(current || "");
  useEffect(() => setVal(current || ""), [current]);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="label">Current bowler</label>
        <select className="input" value={val} onChange={(e) => setVal(e.target.value)}>
          <option value="">Select…</option>
          {bowlers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <button
        disabled={!val || val === current || busy}
        onClick={() => onChange(val)}
        className="btn-ghost"
      >
        Set bowler
      </button>
    </div>
  );
}

function BallEntry({
  striker,
  nonStriker,
  bowler,
  battingTeamPlayers,
  dismissedPlayerIds,
  busy,
  onBall,
  onUndo,
}: {
  striker?: Player;
  nonStriker?: Player;
  bowler?: Player;
  battingTeamPlayers: Player[];
  dismissedPlayerIds: string[];
  busy: boolean;
  onBall: (b: any) => void;
  onUndo: () => void;
}) {
  const [extraType, setExtraType] = useState<"" | "WIDE" | "NO_BALL" | "BYE" | "LEG_BYE">("");
  const [extraRuns, setExtraRuns] = useState<number>(0);
  const [showWicket, setShowWicket] = useState(false);
  const [wicketType, setWicketType] = useState<string>("BOWLED");
  const [dismissedPlayerId, setDismissedPlayerId] = useState<string>("");
  const [newBatterId, setNewBatterId] = useState<string>("");

  function reset() {
    setExtraType("");
    setExtraRuns(0);
    setShowWicket(false);
    setWicketType("BOWLED");
    setDismissedPlayerId("");
    setNewBatterId("");
  }

  function submit(runs: number) {
    const isWicket = showWicket;
    const dismissed = isWicket
      ? dismissedPlayerId || (striker?.id ?? "")
      : null;

    onBall({
      runs,
      extras: extraType ? extraRuns || (extraType === "WIDE" || extraType === "NO_BALL" ? 1 : 0) : 0,
      extraType: extraType || null,
      isWicket,
      wicketType: isWicket ? wicketType : null,
      dismissedPlayerId: dismissed || null,
      newBatterId: isWicket ? newBatterId || null : null,
    });
    reset();
  }

  // Available new batters = batting team minus the two on crease and minus
  // anyone who has already been dismissed in this innings.
  const dismissed = new Set(dismissedPlayerIds);
  const availableNewBatters = battingTeamPlayers.filter(
    (p) =>
      p.id !== striker?.id &&
      p.id !== nonStriker?.id &&
      !dismissed.has(p.id),
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
        <div>
          On strike: <b className="text-slate-900">{striker?.name ?? "?"}</b> ·{" "}
          Non-striker: <b className="text-slate-900">{nonStriker?.name ?? "?"}</b> ·{" "}
          Bowler: <b className="text-slate-900">{bowler?.name ?? "?"}</b>
        </div>
        <button onClick={onUndo} disabled={busy} className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
          Undo last ball
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {[0, 1, 2, 3, 4, 5, 6].map((r) => (
          <button
            key={r}
            disabled={busy || !striker || !bowler}
            onClick={() => submit(r)}
            className={
              "h-14 rounded-xl text-lg font-bold ring-1 transition " +
              (r === 4
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                : r === 6
                ? "bg-hitachi text-white ring-hitachi hover:bg-hitachi-dark"
                : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50")
            }
          >
            {r}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Extra type</label>
          <div className="flex flex-wrap gap-2">
            {([
              ["", "None"],
              ["WIDE", "Wide"],
              ["NO_BALL", "No-ball"],
              ["BYE", "Bye"],
              ["LEG_BYE", "Leg-bye"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setExtraType(val as any)}
                className={
                  "rounded-md px-3 py-1.5 text-xs font-medium ring-1 transition " +
                  (extraType === val
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Extra runs (e.g. extra wide runs, byes)</label>
          <input
            className="input"
            type="number"
            min={0}
            max={6}
            value={extraRuns}
            onChange={(e) => setExtraRuns(Number(e.target.value || 0))}
            disabled={!extraType}
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <input
            type="checkbox"
            checked={showWicket}
            onChange={(e) => setShowWicket(e.target.checked)}
          />
          Wicket on this ball
        </label>
        {showWicket && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={wicketType} onChange={(e) => setWicketType(e.target.value)}>
                <option value="BOWLED">Bowled</option>
                <option value="CAUGHT">Caught</option>
                <option value="LBW">LBW</option>
                <option value="RUN_OUT">Run out</option>
                <option value="STUMPED">Stumped</option>
                <option value="HIT_WICKET">Hit wicket</option>
              </select>
            </div>
            <div>
              <label className="label">Dismissed batter</label>
              <select className="input" value={dismissedPlayerId} onChange={(e) => setDismissedPlayerId(e.target.value)}>
                <option value="">{striker?.name ? `Striker: ${striker.name}` : "Striker"}</option>
                {nonStriker && <option value={nonStriker.id}>Non-striker: {nonStriker.name}</option>}
              </select>
            </div>
            <div>
              <label className="label">New batter</label>
              <select className="input" value={newBatterId} onChange={(e) => setNewBatterId(e.target.value)}>
                <option value="">Select…</option>
                {availableNewBatters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={busy || !striker || !bowler} onClick={() => submit(0)} className="btn-ghost">Dot ball</button>
        <button disabled={busy || !striker || !bowler || !extraType} onClick={() => submit(0)} className="btn-dark">
          Submit extras only (0 off bat)
        </button>
      </div>
    </div>
  );
}

function RecentBalls({ innings }: { innings: Innings }) {
  if (innings.balls.length === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-base font-bold text-slate-900">Last balls</h3>
      <div className="flex flex-wrap gap-2">
        {innings.balls.slice().reverse().map((b) => (
          <BallChip key={b.id} ball={b} />
        ))}
      </div>
    </div>
  );
}

function BallChip({ ball }: { ball: Ball }) {
  let label = String(ball.runs);
  let cls = "bg-slate-100 text-slate-800";

  if (ball.extraType === "WIDE") {
    label = `${ball.runs + ball.extras}wd`;
    cls = "bg-amber-100 text-amber-800";
  } else if (ball.extraType === "NO_BALL") {
    label = `${ball.runs + ball.extras}nb`;
    cls = "bg-amber-100 text-amber-800";
  } else if (ball.extraType === "BYE") {
    label = `${ball.extras}b`;
    cls = "bg-blue-100 text-blue-800";
  } else if (ball.extraType === "LEG_BYE") {
    label = `${ball.extras}lb`;
    cls = "bg-blue-100 text-blue-800";
  } else if (ball.runs === 4) {
    cls = "bg-emerald-100 text-emerald-800";
  } else if (ball.runs === 6) {
    cls = "bg-hitachi text-white";
  }

  if (ball.isWicket) {
    label = "W";
    cls = "bg-red-600 text-white";
  }

  return (
    <span className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-bold ${cls}`}>
      {label}
    </span>
  );
}

function FullScorecardSection({
  innings,
  awards,
  matchStatus,
  defaultOpen,
}: {
  innings: Innings[];
  awards?: MatchAwards;
  matchStatus: string;
  defaultOpen: boolean;
}) {
  if (innings.length === 0) return null;
  return (
    <div className="card overflow-hidden">
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer items-center justify-between px-5 py-4 hover:bg-slate-50">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-hitachi/10 text-hitachi">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
            </span>
            <span className="text-base font-bold text-slate-900">Full scorecard</span>
            <span className="text-xs text-slate-500">
              {innings.length === 2 ? "Both innings" : "Innings 1"}
            </span>
          </div>
          <span className="text-xs font-medium text-hitachi group-open:hidden">Show</span>
          <span className="hidden text-xs font-medium text-slate-500 group-open:inline">Hide</span>
        </summary>

        <div className="space-y-6 border-t border-slate-100 px-5 py-5">
          {matchStatus === "COMPLETED" && <AwardsPanel awards={awards} />}
          {innings.map((i) => (
            <InningsScorecardBlock key={i.id} innings={i} />
          ))}
        </div>
      </details>
    </div>
  );
}

function InningsScorecardBlock({ innings: i }: { innings: Innings }) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-base font-bold text-slate-900">
          {i.battingTeam.name} — Innings {i.inningsNumber}
        </h3>
        <div className="text-right">
          <div className="text-xl font-black tabular-nums text-slate-900">
            {i.totalRuns}/{i.totalWickets}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            ({i.oversText} ov) · RR {i.runRate}
            {i.extras > 0 ? ` · Extras ${i.extras}` : ""}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Batting</div>
          <table className="mt-1 w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1">Batter</th>
                <th className="py-1 text-right">R</th>
                <th className="py-1 text-right">B</th>
                <th className="py-1 text-right">4s</th>
                <th className="py-1 text-right">6s</th>
                <th className="py-1 text-right">SR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {i.battingEntries.map((b) => (
                <tr key={b.id}>
                  <td className="py-1.5">
                    {b.player.name}
                    {!b.isOut && b.balls > 0 && <span className="text-slate-400">*</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{b.runs}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.balls}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.fours}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.sixes}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.strikeRate || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Bowling</div>
          <table className="mt-1 w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1">Bowler</th>
                <th className="py-1 text-right">O</th>
                <th className="py-1 text-right">R</th>
                <th className="py-1 text-right">W</th>
                <th className="py-1 text-right">Econ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {i.bowlingEntries.map((b) => (
                <tr key={b.id}>
                  <td className="py-1.5">{b.player.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.oversText}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.runsConceded}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{b.wickets}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.economy || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AwardsPanel({ awards }: { awards?: MatchAwards }) {
  if (!awards) return null;
  const { bestBatter, bestBowler, manOfTheMatch } = awards;
  if (!bestBatter && !bestBowler && !manOfTheMatch) return null;
  return (
    <div>
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Match awards
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {manOfTheMatch && (
          <AwardCard
            title="Man of the Match"
            highlight
            playerId={manOfTheMatch.playerId}
            name={manOfTheMatch.playerName}
            team={manOfTheMatch.teamName}
            stat={manOfTheMatch.headline}
            note={manOfTheMatch.caption}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            }
          />
        )}
        {bestBatter && (
          <AwardCard
            title="Best Batter"
            playerId={bestBatter.playerId}
            name={bestBatter.playerName}
            team={bestBatter.teamName}
            stat={bestBatter.headline}
            note={bestBatter.caption}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 5l5 5"/><path d="m13.5 5.5-9 9c-.6.6-.6 1.5 0 2l3 3c.6.6 1.5.6 2 0l9-9"/><path d="m4 21 3-3"/></svg>
            }
          />
        )}
        {bestBowler && (
          <AwardCard
            title="Best Bowler"
            playerId={bestBowler.playerId}
            name={bestBowler.playerName}
            team={bestBowler.teamName}
            stat={bestBowler.headline}
            note={bestBowler.caption}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/></svg>
            }
          />
        )}
      </div>
    </div>
  );
}

function AwardCard({
  title,
  name,
  team,
  stat,
  note,
  playerId,
  highlight,
  icon,
}: {
  title: string;
  name: string;
  team: string;
  stat: string;
  note: string;
  playerId: string;
  highlight?: boolean;
  icon: React.ReactNode;
}) {
  const wrapCls = highlight
    ? "rounded-xl bg-gradient-to-br from-hitachi to-hitachi-dark p-4 text-white shadow-card"
    : "rounded-xl bg-white p-4 ring-1 ring-slate-100";
  const titleCls = highlight ? "text-white/80" : "text-slate-500";
  const nameCls = highlight ? "text-white" : "text-slate-900";
  const statCls = highlight ? "text-white" : "text-slate-900";
  const noteCls = highlight ? "text-white/70" : "text-slate-500";

  return (
    <div className={wrapCls}>
      <div className="flex items-center gap-2">
        <span className={highlight ? "text-white" : "text-hitachi"}>{icon}</span>
        <div className={`text-[11px] font-semibold uppercase tracking-widest ${titleCls}`}>
          {title}
        </div>
      </div>
      <Link href={`/players/${playerId}`} className={`mt-2 block text-base font-bold hover:underline ${nameCls}`}>
        {name}
      </Link>
      <div className={`text-xs ${noteCls}`}>{team}</div>
      <div className={`mt-2 text-2xl font-black tabular-nums ${statCls}`}>{stat}</div>
      <div className={`text-xs ${noteCls}`}>{note}</div>
    </div>
  );
}
