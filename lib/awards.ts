import { prisma } from "./prisma";
import { computeEconomy, computeStrikeRate, formatOvers } from "./scoring";

export type Award = {
  playerId: string;
  playerName: string;
  teamName: string;
  headline: string;   // e.g. "47 (32) · SR 146.88"
  caption: string;    // e.g. "Top-scored across both innings"
};

export type MatchAwards = {
  bestBatter: Award | null;
  bestBowler: Award | null;
  manOfTheMatch: (Award & { score: number }) | null;
};

/**
 * Compute match awards from the recorded innings/balls.
 *  - Best batter: most runs (tiebreak: more boundaries, then higher SR).
 *  - Best bowler: most wickets (tiebreak: lower economy among legal balls).
 *  - Man of the match: combined impact score across both innings.
 *      score = runs scored
 *            + 20 * wickets
 *            - max(0, runsConceded - 6 * oversBowled) * 0.3
 *    (penalises only economy worse than 6 RPO)
 */
export async function computeMatchAwards(matchId: string): Promise<MatchAwards> {
  const [battingEntries, bowlingEntries, match] = await Promise.all([
    prisma.battingEntry.findMany({
      where: { innings: { matchId } },
      include: { player: { include: { team: true } } },
    }),
    prisma.bowlingEntry.findMany({
      where: { innings: { matchId } },
      include: { player: { include: { team: true } } },
    }),
    prisma.match.findUnique({
      where: { id: matchId },
      include: {
        team1: { select: { id: true, name: true } },
        team2: { select: { id: true, name: true } },
        matchPlayers: { select: { playerId: true, side: true } },
      },
    }),
  ]);

  // Decide who won so we can bias Man-of-the-Match towards the
  // winning side. Falls back to "any side" when the match is still
  // live, ended in a tie, or pre-dates the winnerTeamId field.
  const winnerTeamId: string | null =
    (match as any)?.winnerTeamId ?? null;
  const winnerSide: 1 | 2 | null = match
    ? winnerTeamId === match.team1.id
      ? 1
      : winnerTeamId === match.team2.id
      ? 2
      : null
    : null;
  const winnerPlayerIds = new Set<string>();
  if (match && winnerSide) {
    for (const mp of match.matchPlayers) {
      if (mp.side === winnerSide) winnerPlayerIds.add(mp.playerId);
    }
  }

  // Map: playerId -> team name they played for in THIS match (per-match roster
  // takes precedence over Player.team for display).
  const matchTeamByPlayer = new Map<string, string>();
  if (match) {
    for (const mp of match.matchPlayers) {
      const name =
        mp.side === 1
          ? match.team1.name
          : mp.side === 2
          ? match.team2.name
          : null;
      if (name) matchTeamByPlayer.set(mp.playerId, name);
    }
  }
  const teamNameFor = (playerId: string, fallback: string | null | undefined) =>
    matchTeamByPlayer.get(playerId) ?? fallback ?? "Free agent";

  // -- Best batter ---------------------------------------------------------
  let bestBatter: Award | null = null;
  let bestBatterRuns = -1;
  let bestBatterBoundaries = -1;
  let bestBatterSR = -1;
  for (const b of battingEntries) {
    if (b.runs === 0 && b.balls === 0) continue;
    const sr = computeStrikeRate(b.runs, b.balls);
    const boundaries = b.fours + b.sixes;
    const better =
      b.runs > bestBatterRuns ||
      (b.runs === bestBatterRuns && boundaries > bestBatterBoundaries) ||
      (b.runs === bestBatterRuns && boundaries === bestBatterBoundaries && sr > bestBatterSR);
    if (better) {
      bestBatterRuns = b.runs;
      bestBatterBoundaries = boundaries;
      bestBatterSR = sr;
      bestBatter = {
        playerId: b.playerId,
        playerName: b.player.name,
        teamName: teamNameFor(b.playerId, b.player.team?.name),
        headline: `${b.runs} (${b.balls})${b.isOut ? "" : "*"}`,
        caption: `${b.fours} fours · ${b.sixes} sixes · SR ${sr || "-"}`,
      };
    }
  }

  // -- Best bowler ---------------------------------------------------------
  let bestBowler: Award | null = null;
  let bestBowlerWkts = -1;
  let bestBowlerEcon = Infinity;
  for (const b of bowlingEntries) {
    if (b.balls === 0 && b.wickets === 0) continue;
    const econ = computeEconomy(b.runsConceded, b.balls);
    const better =
      b.wickets > bestBowlerWkts ||
      (b.wickets === bestBowlerWkts && econ < bestBowlerEcon);
    if (better) {
      bestBowlerWkts = b.wickets;
      bestBowlerEcon = econ;
      bestBowler = {
        playerId: b.playerId,
        playerName: b.player.name,
        teamName: teamNameFor(b.playerId, b.player.team?.name),
        headline: `${b.wickets}/${b.runsConceded}`,
        caption: `${formatOvers(b.balls)} ov · Econ ${econ || "-"}`,
      };
    }
  }

  // -- Man of the match (combined impact) ---------------------------------
  type Agg = {
    playerId: string;
    playerName: string;
    teamName: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    wickets: number;
    legalBalls: number;
    runsConceded: number;
  };
  const agg = new Map<string, Agg>();
  for (const b of battingEntries) {
    const cur = agg.get(b.playerId) ?? {
      playerId: b.playerId,
      playerName: b.player.name,
      teamName: teamNameFor(b.playerId, b.player.team?.name),
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      wickets: 0,
      legalBalls: 0,
      runsConceded: 0,
    };
    cur.runs += b.runs;
    cur.balls += b.balls;
    cur.fours += b.fours;
    cur.sixes += b.sixes;
    agg.set(b.playerId, cur);
  }
  for (const b of bowlingEntries) {
    const cur = agg.get(b.playerId) ?? {
      playerId: b.playerId,
      playerName: b.player.name,
      teamName: teamNameFor(b.playerId, b.player.team?.name),
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      wickets: 0,
      legalBalls: 0,
      runsConceded: 0,
    };
    cur.wickets += b.wickets;
    cur.legalBalls += b.balls;
    cur.runsConceded += b.runsConceded;
    agg.set(b.playerId, cur);
  }

  // Score every player. We split the candidate pool: when a winner
  // exists, we restrict MOM to the winning side and only fall back to
  // the global best if nobody on the winning side recorded any
  // measurable contribution (extreme edge case).
  type Scored = Agg & { score: number };
  const scored: Scored[] = [];
  for (const p of agg.values()) {
    const overs = p.legalBalls / 6;
    const economyPenalty =
      overs > 0 ? Math.max(0, p.runsConceded - 6 * overs) * 0.3 : 0;
    const score = p.runs + 20 * p.wickets - economyPenalty;
    scored.push({ ...p, score });
  }
  scored.sort((a, b) => b.score - a.score);

  let momPlayer: Agg | null = null;
  let momScore = -Infinity;
  if (winnerPlayerIds.size > 0) {
    const fromWinner = scored.find(
      (p) => winnerPlayerIds.has(p.playerId) && p.score > 0,
    );
    if (fromWinner) {
      momPlayer = fromWinner;
      momScore = fromWinner.score;
    }
  }
  if (!momPlayer && scored.length > 0 && scored[0].score > -Infinity) {
    momPlayer = scored[0];
    momScore = scored[0].score;
  }

  let manOfTheMatch: (Award & { score: number }) | null = null;
  if (momPlayer && momScore > 0) {
    const parts: string[] = [];
    if (momPlayer.runs > 0 || momPlayer.balls > 0) {
      parts.push(`${momPlayer.runs} (${momPlayer.balls})`);
    }
    if (momPlayer.wickets > 0 || momPlayer.legalBalls > 0) {
      parts.push(
        `${momPlayer.wickets}/${momPlayer.runsConceded} in ${formatOvers(
          momPlayer.legalBalls,
        )}`,
      );
    }
    manOfTheMatch = {
      playerId: momPlayer.playerId,
      playerName: momPlayer.playerName,
      teamName: momPlayer.teamName,
      headline: parts.join("  ·  ") || "—",
      caption: `Impact score ${Math.round(momScore * 10) / 10}`,
      score: momScore,
    };
  }

  return { bestBatter, bestBowler, manOfTheMatch };
}
