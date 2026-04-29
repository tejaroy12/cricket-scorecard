import { prisma } from "./prisma";

export type ExtraType = "WIDE" | "NO_BALL" | "BYE" | "LEG_BYE" | null;
export type WicketType =
  | "BOWLED"
  | "CAUGHT"
  | "LBW"
  | "RUN_OUT"
  | "STUMPED"
  | "HIT_WICKET"
  | null;

export interface BallInput {
  inningsId: string;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  runs: number;        // runs off the bat
  extras: number;      // extra runs (e.g. 1 for a wide, more for byes etc.)
  extraType: ExtraType;
  isWicket: boolean;
  wicketType: WicketType;
  dismissedPlayerId?: string | null;
  /**
   * If a wicket falls and a new batter must come in, the admin selects them.
   * For RUN_OUT this could be either striker or non-striker.
   */
  newBatterId?: string | null;
  commentary?: string;
}

/**
 * Format overs as "X.Y" where Y is balls in current over (0..5).
 */
export function formatOvers(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function computeStrikeRate(runs: number, balls: number): number {
  if (balls === 0) return 0;
  return Math.round((runs / balls) * 10000) / 100;
}

export function computeEconomy(runs: number, legalBalls: number): number {
  if (legalBalls === 0) return 0;
  const overs = legalBalls / 6;
  return Math.round((runs / overs) * 100) / 100;
}

/**
 * Apply a ball to the innings inside a single transaction.
 * Updates: Ball row, Innings totals, BattingEntry (striker, possibly non-striker, possibly new batter),
 * BowlingEntry (bowler), and rotates strike where applicable.
 */
export async function applyBall(input: BallInput) {
  return prisma.$transaction(async (tx) => {
    const innings = await tx.innings.findUnique({
      where: { id: input.inningsId },
      include: { match: true },
    });
    if (!innings) throw new Error("Innings not found");
    if (innings.isClosed) throw new Error("Innings is already closed");

    const isLegal =
      input.extraType !== "WIDE" && input.extraType !== "NO_BALL";

    // Determine ball position
    const lastBall = await tx.ball.findFirst({
      where: { inningsId: input.inningsId },
      orderBy: { sequence: "desc" },
    });
    const sequence = (lastBall?.sequence ?? 0) + 1;

    const overNumber = Math.floor(innings.totalBalls / 6);
    const ballInOver = (innings.totalBalls % 6) + 1;

    // Total runs from this delivery
    const totalRunsThisBall = input.runs + input.extras;

    // Create ball record
    await tx.ball.create({
      data: {
        inningsId: input.inningsId,
        sequence,
        overNumber,
        ballInOver,
        strikerId: input.strikerId,
        nonStrikerId: input.nonStrikerId,
        bowlerId: input.bowlerId,
        runs: input.runs,
        extras: input.extras,
        extraType: input.extraType,
        isLegal,
        isWicket: input.isWicket,
        wicketType: input.wicketType,
        dismissedPlayerId: input.dismissedPlayerId ?? null,
        commentary: input.commentary ?? null,
      },
    });

    // Update innings totals
    await tx.innings.update({
      where: { id: input.inningsId },
      data: {
        totalRuns: { increment: totalRunsThisBall },
        totalWickets: input.isWicket ? { increment: 1 } : undefined,
        totalBalls: isLegal ? { increment: 1 } : undefined,
        extras: { increment: input.extras },
      },
    });

    // Ensure batting entries exist for striker / non-striker
    await ensureBattingEntry(tx, input.inningsId, input.strikerId);
    await ensureBattingEntry(tx, input.inningsId, input.nonStrikerId);

    // Update striker batting stats
    // Wides: do NOT credit bat runs / balls faced.
    // No-ball: ball faced is NOT counted; runs off the bat ARE credited.
    // Bye / Leg-bye: ball IS counted, runs are NOT credited to bat.
    const strikerRunsAdd =
      input.extraType === "BYE" || input.extraType === "LEG_BYE"
        ? 0
        : input.runs;
    const strikerBallsAdd =
      input.extraType === "WIDE" || input.extraType === "NO_BALL" ? 0 : 1;

    const isFour = strikerRunsAdd === 4;
    const isSix = strikerRunsAdd === 6;

    await tx.battingEntry.update({
      where: {
        inningsId_playerId: {
          inningsId: input.inningsId,
          playerId: input.strikerId,
        },
      },
      data: {
        runs: { increment: strikerRunsAdd },
        balls: { increment: strikerBallsAdd },
        fours: isFour ? { increment: 1 } : undefined,
        sixes: isSix ? { increment: 1 } : undefined,
      },
    });

    // Bowling entry
    await ensureBowlingEntry(tx, input.inningsId, input.bowlerId);

    // Runs charged to bowler:
    //   - all bat runs
    //   - wides + no-balls are charged
    //   - byes + leg-byes are NOT charged
    let runsToBowler = input.runs;
    if (input.extraType === "WIDE" || input.extraType === "NO_BALL") {
      runsToBowler += input.extras;
    }

    await tx.bowlingEntry.update({
      where: {
        inningsId_playerId: {
          inningsId: input.inningsId,
          playerId: input.bowlerId,
        },
      },
      data: {
        balls: isLegal ? { increment: 1 } : undefined,
        runsConceded: { increment: runsToBowler },
        wickets:
          input.isWicket &&
          input.wicketType !== "RUN_OUT" &&
          input.wicketType !== null
            ? { increment: 1 }
            : undefined,
        wides: input.extraType === "WIDE" ? { increment: 1 } : undefined,
        noBalls: input.extraType === "NO_BALL" ? { increment: 1 } : undefined,
      },
    });

    // Wicket bookkeeping
    if (input.isWicket && input.dismissedPlayerId) {
      const outDesc = buildOutDescription(input);
      await tx.battingEntry.update({
        where: {
          inningsId_playerId: {
            inningsId: input.inningsId,
            playerId: input.dismissedPlayerId,
          },
        },
        data: {
          isOut: true,
          outDesc,
          isOnCrease: false,
          isStriker: false,
        },
      });

      // Bring in new batter (if provided & there are wickets remaining)
      if (input.newBatterId) {
        await ensureBattingEntry(tx, input.inningsId, input.newBatterId);
        // The new batter takes the position of the dismissed batter.
        // We DO NOT auto-rotate strike here for the wicket; we set new batter
        // to where the dismissed batter was (striker vs non-striker).
        const dismissedWasStriker =
          input.dismissedPlayerId === input.strikerId;
        await tx.battingEntry.update({
          where: {
            inningsId_playerId: {
              inningsId: input.inningsId,
              playerId: input.newBatterId,
            },
          },
          data: {
            isOnCrease: true,
            isStriker: dismissedWasStriker,
          },
        });
      }
    }

    // Strike rotation:
    //  - Odd runs off the bat -> rotate
    //  - End of over (legal ball completes 6) -> rotate
    //  - Wides/no-balls don't rotate by themselves (unless extras runs are odd via byes-on-noball etc.; we keep it simple)
    const oddRunsOffBat = input.runs % 2 === 1;
    const completedOver = isLegal && (innings.totalBalls + 1) % 6 === 0;

    let shouldRotate = oddRunsOffBat;
    if (completedOver) shouldRotate = !shouldRotate;

    if (shouldRotate && !(input.isWicket && input.dismissedPlayerId)) {
      // Toggle striker / non-striker flags between current striker & non-striker
      await tx.battingEntry.update({
        where: {
          inningsId_playerId: {
            inningsId: input.inningsId,
            playerId: input.strikerId,
          },
        },
        data: { isStriker: false },
      });
      await tx.battingEntry.update({
        where: {
          inningsId_playerId: {
            inningsId: input.inningsId,
            playerId: input.nonStrikerId,
          },
        },
        data: { isStriker: true },
      });
    }

    // Auto-close innings when all out, all overs bowled, or chase target reached
    const after = await tx.innings.findUnique({
      where: { id: input.inningsId },
      include: {
        match: {
          select: {
            id: true,
            oversPerSide: true,
            team1Id: true,
            team2Id: true,
            matchPlayers: { select: { id: true, side: true } },
          },
        },
        battingTeam: { select: { players: { select: { id: true } } } },
      },
    });
    if (after && !after.isClosed) {
      // Prefer per-match roster size; fall back to team.players for legacy matches.
      const battingSide =
        after.battingTeamId === after.match.team1Id
          ? 1
          : after.battingTeamId === after.match.team2Id
          ? 2
          : 0;
      const matchRosterSize = after.match.matchPlayers.filter(
        (mp) => mp.side === battingSide,
      ).length;
      const teamSize =
        matchRosterSize > 0 ? matchRosterSize : after.battingTeam.players.length;

      // Super-over innings carry their own per-innings `maxOvers` /
      // `maxWickets` (typically 1 over / 2 wickets). Fall back to the
      // match-level overs and the standard "team-size minus 1" rule
      // otherwise.
      const effectiveMaxOvers = after.maxOvers ?? after.match.oversPerSide;
      const effectiveMaxWickets =
        after.maxWickets ?? Math.max(1, teamSize - 1);

      const allOut =
        effectiveMaxWickets > 0 && after.totalWickets >= effectiveMaxWickets;
      const oversComplete = after.totalBalls >= effectiveMaxOvers * 6;

      // For the standard chase (innings 2) and the super-over chase
      // (innings 4) we close as soon as the target is overtaken.
      let chaseWon = false;
      if (after.inningsNumber === 2) {
        const innings1 = await tx.innings.findFirst({
          where: { matchId: after.match.id, inningsNumber: 1 },
        });
        if (innings1 && after.totalRuns > innings1.totalRuns) chaseWon = true;
      } else if (after.inningsNumber === 4) {
        const innings3 = await tx.innings.findFirst({
          where: { matchId: after.match.id, inningsNumber: 3 },
        });
        if (innings3 && after.totalRuns > innings3.totalRuns) chaseWon = true;
      }

      if (allOut || oversComplete || chaseWon) {
        await tx.innings.update({
          where: { id: input.inningsId },
          data: { isClosed: true },
        });
      }
    }

    return { ok: true };
  });
}

async function ensureBattingEntry(
  tx: any,
  inningsId: string,
  playerId: string,
) {
  const existing = await tx.battingEntry.findUnique({
    where: { inningsId_playerId: { inningsId, playerId } },
  });
  if (existing) return existing;

  const count = await tx.battingEntry.count({ where: { inningsId } });
  return tx.battingEntry.create({
    data: {
      inningsId,
      playerId,
      battingOrder: count + 1,
      isOnCrease: true,
      isStriker: count === 0, // first batter created = striker by default
    },
  });
}

async function ensureBowlingEntry(
  tx: any,
  inningsId: string,
  playerId: string,
) {
  const existing = await tx.bowlingEntry.findUnique({
    where: { inningsId_playerId: { inningsId, playerId } },
  });
  if (existing) return existing;
  return tx.bowlingEntry.create({
    data: { inningsId, playerId },
  });
}

function buildOutDescription(input: BallInput): string {
  switch (input.wicketType) {
    case "BOWLED":
      return `b ${input.bowlerId}`; // resolved to name in UI by joining player
    case "CAUGHT":
      return `c & b`;
    case "LBW":
      return `lbw b`;
    case "RUN_OUT":
      return `run out`;
    case "STUMPED":
      return `st b`;
    case "HIT_WICKET":
      return `hit wicket b`;
    default:
      return "out";
  }
}

/**
 * Undo the last ball of an innings. Recomputes all derived stats from scratch
 * for that innings to avoid drift.
 */
export async function undoLastBall(inningsId: string) {
  return prisma.$transaction(async (tx) => {
    const last = await tx.ball.findFirst({
      where: { inningsId },
      orderBy: { sequence: "desc" },
    });
    if (!last) return { ok: false, message: "No balls to undo" };
    await tx.ball.delete({ where: { id: last.id } });
    await recomputeInnings(tx, inningsId);
    return { ok: true };
  });
}

export async function recomputeInnings(tx: any, inningsId: string) {
  const balls = await tx.ball.findMany({
    where: { inningsId },
    orderBy: { sequence: "asc" },
  });

  let totalRuns = 0;
  let totalWickets = 0;
  let totalBalls = 0;
  let extras = 0;

  // Reset batting & bowling entries
  await tx.battingEntry.updateMany({
    where: { inningsId },
    data: {
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      outDesc: null,
    },
  });
  await tx.bowlingEntry.updateMany({
    where: { inningsId },
    data: {
      balls: 0,
      runsConceded: 0,
      wickets: 0,
      maidens: 0,
      wides: 0,
      noBalls: 0,
    },
  });

  for (const b of balls) {
    const isLegal = b.isLegal;
    totalRuns += b.runs + b.extras;
    extras += b.extras;
    if (isLegal) totalBalls += 1;
    if (b.isWicket) totalWickets += 1;

    const strikerRunsAdd =
      b.extraType === "BYE" || b.extraType === "LEG_BYE" ? 0 : b.runs;
    const strikerBallsAdd =
      b.extraType === "WIDE" || b.extraType === "NO_BALL" ? 0 : 1;

    await tx.battingEntry.update({
      where: { inningsId_playerId: { inningsId, playerId: b.strikerId } },
      data: {
        runs: { increment: strikerRunsAdd },
        balls: { increment: strikerBallsAdd },
        fours: strikerRunsAdd === 4 ? { increment: 1 } : undefined,
        sixes: strikerRunsAdd === 6 ? { increment: 1 } : undefined,
      },
    });

    let runsToBowler = b.runs;
    if (b.extraType === "WIDE" || b.extraType === "NO_BALL") {
      runsToBowler += b.extras;
    }

    await tx.bowlingEntry.update({
      where: { inningsId_playerId: { inningsId, playerId: b.bowlerId } },
      data: {
        balls: isLegal ? { increment: 1 } : undefined,
        runsConceded: { increment: runsToBowler },
        wickets:
          b.isWicket && b.wicketType !== "RUN_OUT" && b.wicketType !== null
            ? { increment: 1 }
            : undefined,
        wides: b.extraType === "WIDE" ? { increment: 1 } : undefined,
        noBalls: b.extraType === "NO_BALL" ? { increment: 1 } : undefined,
      },
    });

    if (b.isWicket && b.dismissedPlayerId) {
      await tx.battingEntry.update({
        where: {
          inningsId_playerId: {
            inningsId,
            playerId: b.dismissedPlayerId,
          },
        },
        data: { isOut: true },
      });
    }
  }

  await tx.innings.update({
    where: { id: inningsId },
    data: { totalRuns, totalWickets, totalBalls, extras },
  });
}
