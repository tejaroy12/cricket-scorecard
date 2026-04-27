import { prisma } from "./prisma";
import { computeEconomy, computeStrikeRate, formatOvers } from "./scoring";

/**
 * Aggregate career batting + bowling stats for a player across all
 * COMPLETED and LIVE matches.
 */
export async function getPlayerCareerStats(playerId: string) {
  const [battingEntries, bowlingEntries] = await Promise.all([
    prisma.battingEntry.findMany({
      where: { playerId, innings: { match: { status: { in: ["COMPLETED", "LIVE"] } } } },
      include: { innings: { include: { match: true } } },
    }),
    prisma.bowlingEntry.findMany({
      where: { playerId, innings: { match: { status: { in: ["COMPLETED", "LIVE"] } } } },
      include: { innings: { include: { match: true } } },
    }),
  ]);

  // Batting
  const matches = new Set<string>();
  let runs = 0;
  let balls = 0;
  let fours = 0;
  let sixes = 0;
  let dismissals = 0;
  let highest = 0;
  let fifties = 0;
  let hundreds = 0;
  for (const b of battingEntries) {
    matches.add(b.innings.matchId);
    runs += b.runs;
    balls += b.balls;
    fours += b.fours;
    sixes += b.sixes;
    if (b.isOut) dismissals += 1;
    if (b.runs > highest) highest = b.runs;
    if (b.runs >= 100) hundreds += 1;
    else if (b.runs >= 50) fifties += 1;
  }
  const innings = battingEntries.length;
  const average = dismissals > 0 ? Math.round((runs / dismissals) * 100) / 100 : runs > 0 ? runs : 0;

  // Bowling
  let bowlingBalls = 0;
  let runsConceded = 0;
  let wickets = 0;
  let bowlingMatches = new Set<string>();
  let bestBowlingWickets = 0;
  let bestBowlingRuns = 0;
  for (const b of bowlingEntries) {
    bowlingMatches.add(b.innings.matchId);
    bowlingBalls += b.balls;
    runsConceded += b.runsConceded;
    wickets += b.wickets;
    if (
      b.wickets > bestBowlingWickets ||
      (b.wickets === bestBowlingWickets && (bestBowlingWickets === 0 || b.runsConceded < bestBowlingRuns))
    ) {
      bestBowlingWickets = b.wickets;
      bestBowlingRuns = b.runsConceded;
    }
  }
  const bowlingAvg = wickets > 0 ? Math.round((runsConceded / wickets) * 100) / 100 : 0;

  return {
    batting: {
      matches: matches.size,
      innings,
      runs,
      balls,
      fours,
      sixes,
      highest,
      fifties,
      hundreds,
      strikeRate: computeStrikeRate(runs, balls),
      average,
      notOuts: innings - dismissals,
    },
    bowling: {
      matches: bowlingMatches.size,
      innings: bowlingEntries.length,
      overs: formatOvers(bowlingBalls),
      legalBalls: bowlingBalls,
      runsConceded,
      wickets,
      economy: computeEconomy(runsConceded, bowlingBalls),
      average: bowlingAvg,
      best: bestBowlingWickets > 0 ? `${bestBowlingWickets}/${bestBowlingRuns}` : "-",
    },
    matchesPlayed: new Set([...matches, ...bowlingMatches]).size,
  };
}

/**
 * Top scorers (career runs) and top wicket-takers across the league.
 */
export async function getLeaderboards(limit = 10) {
  const [batters, bowlers] = await Promise.all([
    prisma.battingEntry.groupBy({
      by: ["playerId"],
      _sum: { runs: true, balls: true, fours: true, sixes: true },
      orderBy: { _sum: { runs: "desc" } },
      take: limit,
    }),
    prisma.bowlingEntry.groupBy({
      by: ["playerId"],
      _sum: { wickets: true, runsConceded: true, balls: true },
      orderBy: { _sum: { wickets: "desc" } },
      take: limit,
    }),
  ]);

  const allIds = Array.from(new Set([...batters.map((b) => b.playerId), ...bowlers.map((b) => b.playerId)]));
  const players = await prisma.player.findMany({
    where: { id: { in: allIds } },
    include: { team: true },
  });
  const map = new Map(players.map((p) => [p.id, p]));

  return {
    batters: batters
      .filter((b) => map.has(b.playerId))
      .map((b) => ({
        player: map.get(b.playerId)!,
        runs: b._sum.runs ?? 0,
        balls: b._sum.balls ?? 0,
        fours: b._sum.fours ?? 0,
        sixes: b._sum.sixes ?? 0,
        strikeRate: computeStrikeRate(b._sum.runs ?? 0, b._sum.balls ?? 0),
      })),
    bowlers: bowlers
      .filter((b) => map.has(b.playerId))
      .map((b) => ({
        player: map.get(b.playerId)!,
        wickets: b._sum.wickets ?? 0,
        runsConceded: b._sum.runsConceded ?? 0,
        balls: b._sum.balls ?? 0,
        economy: computeEconomy(b._sum.runsConceded ?? 0, b._sum.balls ?? 0),
      })),
  };
}
