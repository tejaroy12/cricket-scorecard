"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BoundaryCelebration } from "@/components/BoundaryCelebration";
import { MatchPredictor } from "@/components/MatchPredictor";

type Player = { id: string; name: string };
type Team = { id: string; name: string; shortName: string };
type BattingEntry = {
  id: string;
  playerId: string;
  player: Player;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  outDesc: string | null;
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
  runs: number;
  extras: number;
  extraType: string | null;
  isWicket: boolean;
  isFreeHit: boolean;
};
type Innings = {
  id: string;
  inningsNumber: number;
  battingTeamId: string;
  battingTeam: Team;
  bowlingTeam: Team;
  totalRuns: number;
  totalWickets: number;
  totalBalls: number;
  oversText: string;
  runRate: number;
  battingEntries: BattingEntry[];
  bowlingEntries: BowlingEntry[];
  balls: Ball[];
  isClosed: boolean;
  maxOvers?: number | null;
  maxWickets?: number | null;
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
type MatchPlayer = { id: string; side: number; playerId: string };
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

export default function LiveMatchView({ initial }: { initial: MatchState }) {
  const [state, setState] = useState<MatchState>(initial);
  const isLive = state.status === "LIVE";
  const [celebrate, setCelebrate] = useState<{
    kind: "FOUR" | "SIX" | "WICKET";
    ts: number;
  } | null>(null);
  const lastSeenBallId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/matches/${state.id}/state`, { cache: "no-store" });
    if (r.ok) setState(await r.json());
  }, [state.id]);

  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [isLive, refresh]);

  const current = useMemo(
    () => state.innings.find((i) => i.id === state.currentInningsId) || null,
    [state.innings, state.currentInningsId],
  );

  useEffect(() => {
    if (!current) return;
    const latest = current.balls[0];
    if (!latest) {
      lastSeenBallId.current = null;
      return;
    }
    if (lastSeenBallId.current === latest.id) return;
    const isInitial = lastSeenBallId.current === null;
    lastSeenBallId.current = latest.id;
    if (isInitial) return;
    if (latest.isWicket) {
      setCelebrate({ kind: "WICKET", ts: Date.now() });
      return;
    }
    if (latest.runs === 4) setCelebrate({ kind: "FOUR", ts: Date.now() });
    else if (latest.runs === 6) setCelebrate({ kind: "SIX", ts: Date.now() });
  }, [current]);

  const innings1 = state.innings.find((i) => i.inningsNumber === 1);
  const innings2 = state.innings.find((i) => i.inningsNumber === 2);

  const target =
    innings2 && innings1 ? innings1.totalRuns + 1 : null;
  const ballsRemaining =
    state.status === "LIVE" && innings2
      ? state.oversPerSide * 6 - innings2.totalBalls
      : null;
  const runsNeeded = target != null && innings2 ? target - innings2.totalRuns : null;

  return (
    <div className="space-y-6">
      <BoundaryCelebration
        kind={celebrate?.kind ?? null}
        nonce={celebrate?.ts ?? 0}
        onDone={() => setCelebrate(null)}
      />
      <div className="card overflow-hidden">
        <div className="hitachi-hero px-6 py-6 text-white">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/70">
            <span>{state.venue} · {state.oversPerSide} overs</span>
            {state.status === "LIVE" && <span className="pill-live">Live</span>}
            {state.status === "COMPLETED" && (
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                Result
              </span>
            )}
            {state.status === "SCHEDULED" && (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white/80">
                Scheduled
              </span>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            <Link href={`/teams/${state.team1.id}`} className="hover:underline">{state.team1.name}</Link>
            <span className="text-white/60"> vs </span>
            <Link href={`/teams/${state.team2.id}`} className="hover:underline">{state.team2.name}</Link>
          </h1>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ScoreBlock team={state.team1} innings={getTeamInnings(state.team1.id, [innings1, innings2])} />
            <ScoreBlock team={state.team2} innings={getTeamInnings(state.team2.id, [innings1, innings2])} />
          </div>

          {state.tossWinner && (
            <div className="mt-3 text-xs text-white/70">
              Toss: {state.tossWinner.name} chose to {state.tossDecision === "BAT" ? "bat" : "bowl"}
            </div>
          )}

          {state.status === "COMPLETED" && state.resultText && (
            <div className="mt-4 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-100 ring-1 ring-emerald-300/20">
              {state.resultText}
            </div>
          )}

          {state.status === "LIVE" && innings2 && target != null && (
            <div className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm text-white/90 ring-1 ring-white/15">
              Target {target} · Need {Math.max(runsNeeded ?? 0, 0)} run{runsNeeded === 1 ? "" : "s"} from{" "}
              {Math.max(ballsRemaining ?? 0, 0)} ball{ballsRemaining === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </div>

      {current && state.status === "LIVE" && (
        <>
          <PublicPredictorBlock state={state} innings={current} />
          <CurrentInningsView innings={current} />
        </>
      )}

      <FullScorecardSection
        innings={state.innings}
        awards={state.awards}
        matchStatus={state.status}
        defaultOpen={state.status === "COMPLETED"}
      />
    </div>
  );
}

function getTeamInnings(teamId: string, list: (Innings | undefined)[]) {
  return list.find((i) => i?.battingTeamId === teamId);
}

function PublicPredictorBlock({
  state,
  innings,
}: {
  state: MatchState;
  innings: Innings;
}) {
  const i1 = state.innings.find((i) => i.inningsNumber === 1);
  const isFirstInnings = innings.inningsNumber === 1;
  const target = !isFirstInnings && i1 ? i1.totalRuns + 1 : null;
  const sideForTeam =
    innings.battingTeamId === state.team1.id ? 1 : 2;
  const rosterFromMP = (state.matchPlayers ?? []).filter(
    (m) => m.side === sideForTeam,
  ).length;
  const rosterSize = rosterFromMP > 0 ? rosterFromMP : 11;
  const totalWickets =
    innings.maxWickets ?? Math.min(10, Math.max(1, rosterSize - 1));
  return (
    <MatchPredictor
      battingTeamName={
        innings.battingTeam.shortName || innings.battingTeam.name
      }
      bowlingTeamName={
        innings.bowlingTeam.shortName || innings.bowlingTeam.name
      }
      input={{
        battingRuns: innings.totalRuns,
        battingWickets: innings.totalWickets,
        battingBalls: innings.totalBalls,
        oversPerSide: innings.maxOvers ?? state.oversPerSide,
        totalWickets,
        target,
        isFirstInnings,
      }}
    />
  );
}

function ScoreBlock({ team, innings }: { team: Team; innings?: Innings }) {
  return (
    <div className="rounded-lg bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
      <div className="text-xs font-semibold uppercase tracking-wider text-white/70">{team.name}</div>
      {innings ? (
        <div className="flex items-baseline justify-between">
          <div className="text-3xl font-black tabular-nums">
            {innings.totalRuns}
            <span className="text-lg font-bold text-white/70">/{innings.totalWickets}</span>
          </div>
          <div className="text-xs tabular-nums text-white/70">
            ({innings.oversText} ov) · RR {innings.runRate}
          </div>
        </div>
      ) : (
        <div className="text-sm text-white/60">Yet to bat</div>
      )}
    </div>
  );
}

function CurrentInningsView({ innings }: { innings: Innings }) {
  const striker = innings.battingEntries.find((b) => b.isOnCrease && b.isStriker);
  const nonStriker = innings.battingEntries.find((b) => b.isOnCrease && !b.isStriker);
  const bowler = innings.bowlingEntries.slice().sort((a, b) => b.balls - a.balls)[0];

  const lastBall = innings.balls[0];
  const nextBallIsFreeHit = !!(
    lastBall &&
    (lastBall.extraType === "NO_BALL" ||
      (lastBall.isFreeHit && lastBall.extraType === "WIDE"))
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        {nextBallIsFreeHit && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 ring-1 ring-amber-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            <div className="flex-1 text-sm">
              <span className="font-black uppercase tracking-widest text-amber-900">
                Free hit
              </span>
              <span className="ml-2 text-xs font-medium text-amber-800">
                Run-out is the only way the batter can be dismissed.
              </span>
            </div>
          </div>
        )}
        <h2 className="text-lg font-bold text-slate-900">Current batting</h2>
        <table className="mt-3 w-full text-left text-sm">
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
            {[striker, nonStriker]
              .filter(Boolean)
              .map((b) => (
                <tr key={b!.id}>
                  <td className="py-1.5">
                    <PlayerLink id={b!.player.id}>{b!.player.name}</PlayerLink>
                    {b!.isStriker && <span className="ml-1 text-hitachi">*</span>}
                  </td>
                  <td className="py-1.5 text-right font-bold tabular-nums">{b!.runs}</td>
                  <td className="py-1.5 text-right tabular-nums">{b!.balls}</td>
                  <td className="py-1.5 text-right tabular-nums">{b!.fours}</td>
                  <td className="py-1.5 text-right tabular-nums">{b!.sixes}</td>
                  <td className="py-1.5 text-right tabular-nums">{b!.strikeRate || "-"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="card p-5">
        <h2 className="text-lg font-bold text-slate-900">Bowling</h2>
        {bowler ? (
          <div className="mt-3">
            <div>
              <PlayerLink id={bowler.player.id}>
                {bowler.player.name}
              </PlayerLink>
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums text-slate-900">
              {bowler.runsConceded}/{bowler.wickets}
            </div>
            <div className="text-xs tabular-nums text-slate-500">
              {bowler.oversText} overs · Econ {bowler.economy || "-"}
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-500">No bowler yet.</div>
        )}
        {innings.balls.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Last balls</div>
            <div className="-mx-2 mt-2 overflow-x-auto px-2 pb-1">
              <div className="flex w-max items-center gap-2">
                {innings.balls.slice().reverse().map((b) => (
                  <BallChip key={b.id} ball={b} />
                ))}
              </div>
            </div>
          </div>
        )}
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
    <span className="relative inline-flex">
      <span
        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-bold ${cls}`}
      >
        {label}
      </span>
      {ball.isFreeHit && (
        <span
          className="absolute -right-1.5 -top-1 inline-flex h-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black uppercase tracking-wide text-white ring-2 ring-white"
          title="Free hit"
        >
          FH
        </span>
      )}
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
        <summary className="flex cursor-pointer items-center justify-between px-5 py-4 hover:bg-slate-50 list-none">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-hitachi/10 text-hitachi">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
            </span>
            <span className="text-base font-bold text-slate-900">Full scorecard</span>
            <span className="text-xs text-slate-500">{innings.length === 2 ? "Both innings" : "Innings 1"}</span>
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
  const extras = (i as any).extras ?? 0;
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
            {extras > 0 ? ` · Extras ${extras}` : ""}
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
                    <div>
                      <PlayerLink id={b.player.id}>{b.player.name}</PlayerLink>
                      {!b.isOut && b.balls > 0 && <span className="text-slate-400">*</span>}
                    </div>
                    {b.isOut && b.outDesc && (
                      <div className="text-[11px] italic text-slate-500">
                        {b.outDesc}
                      </div>
                    )}
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
                  <td className="py-1.5">
                    <PlayerLink id={b.player.id}>{b.player.name}</PlayerLink>
                  </td>
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

function PlayerLink({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/players/${id}`}
      className="font-medium text-slate-900 hover:text-hitachi hover:underline"
    >
      {children}
    </Link>
  );
}
