import { prisma } from "./prisma";
import { computeStrikeRate, computeEconomy, formatOvers } from "./scoring";
import { computeMatchAwards } from "./awards";

export async function getMatchState(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team1: { include: { players: true } },
      team2: { include: { players: true } },
      tossWinner: true,
      matchPlayers: {
        include: { player: true },
      },
      innings: {
        include: {
          battingTeam: { include: { players: true } },
          bowlingTeam: { include: { players: true } },
          battingEntries: {
            include: { player: true },
            orderBy: { battingOrder: "asc" },
          },
          bowlingEntries: {
            include: { player: true },
          },
          balls: {
            include: { striker: true, bowler: true, dismissedPlayer: true },
            orderBy: { sequence: "desc" },
            take: 12,
          },
        },
        orderBy: { inningsNumber: "asc" },
      },
    },
  });

  if (!match) return null;

  const currentInnings = match.innings.find((i) => !i.isClosed) || match.innings[match.innings.length - 1];

  const enriched = match.innings.map((i) => ({
    ...i,
    oversText: formatOvers(i.totalBalls),
    runRate:
      i.totalBalls === 0
        ? 0
        : Math.round((i.totalRuns / (i.totalBalls / 6)) * 100) / 100,
    battingEntries: i.battingEntries.map((b) => ({
      ...b,
      strikeRate: computeStrikeRate(b.runs, b.balls),
    })),
    bowlingEntries: i.bowlingEntries.map((b) => ({
      ...b,
      oversText: formatOvers(b.balls),
      economy: computeEconomy(b.runsConceded, b.balls),
    })),
  }));

  const awards = await computeMatchAwards(matchId);

  return {
    ...match,
    innings: enriched,
    currentInningsId: currentInnings?.id ?? null,
    awards,
  };
}

export type MatchState = NonNullable<Awaited<ReturnType<typeof getMatchState>>>;
