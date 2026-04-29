/**
 * Lightweight match predictor.
 *
 * We don't have the full DLS resource table (which is proprietary) but
 * we can produce a reasonable, Crex-style "Par score / Win %" panel
 * using a wicket-weighted resource model. The main inputs are:
 *   - balls bowled / balls remaining
 *   - wickets fallen / wickets in hand
 *   - per-side overs (max overs)
 *   - per-side max wickets (= rosterSize - 1, capped at 10)
 *
 * Win % is a heuristic that combines the run-rate gap (current vs
 * required) with the wickets-in-hand cushion. It's bounded to (1, 99)
 * so the UI never shows a deceptive 0% or 100% mid-game.
 */

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/**
 * Wicket-weighted resource percentage. We use a quick approximation of
 * the DLS table where wickets-in-hand contributes more value as the
 * innings progresses. Returns 0–100.
 */
export function resourcePercentage({
  ballsBowled,
  totalBalls,
  wicketsLost,
  totalWickets,
}: {
  ballsBowled: number;
  totalBalls: number;
  wicketsLost: number;
  totalWickets: number;
}): number {
  if (totalBalls <= 0) return 0;
  const ballsLeft = Math.max(0, totalBalls - ballsBowled);
  const wktsLeft = Math.max(0, totalWickets - wicketsLost);

  // Time-only resource (linear with balls left).
  const timeResource = ballsLeft / totalBalls;
  // Wicket multiplier — sigmoid-shaped so 0 wkts left ≈ 0%, full
  // wickets left ≈ 1.0. Penalises mid-late losses harder than early.
  const w = wktsLeft / Math.max(1, totalWickets);
  const wktMultiplier = 0.4 + 0.6 * Math.pow(w, 0.85);

  return clamp(100 * timeResource * wktMultiplier, 0, 100);
}

export interface PredictorInput {
  // Side currently batting (the chasing side in 2nd innings; the side
  // setting a target in 1st innings).
  battingRuns: number;
  battingWickets: number;
  battingBalls: number; // legal balls already bowled this innings
  // Match constants for this innings.
  oversPerSide: number; // total overs available to the batting side
  totalWickets: number; // typically rosterSize - 1, capped at 10
  // For 2nd innings: target = 1st innings runs + 1, else null.
  target: number | null;
  // True for first innings; we compute projected score instead of
  // chase math.
  isFirstInnings: boolean;
}

export interface PredictorOutput {
  ballsRemaining: number;
  oversRemainingText: string;
  currentRunRate: number;
  /** Required run rate for the chase. null in 1st innings. */
  requiredRunRate: number | null;
  /** Projected total assuming current run rate continues. */
  projectedScore: number;
  /** DLS-style par score for the chase at this stage. null in 1st. */
  parScore: number | null;
  /** How many runs the chase is ahead/behind par. null in 1st. */
  parDelta: number | null;
  /** Win probability for the batting side, 1-99. */
  winPercent: number;
}

const formatOversText = (balls: number) => {
  const overs = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${overs}.${rem}`;
};

export function predict(input: PredictorInput): PredictorOutput {
  const totalBalls = input.oversPerSide * 6;
  const ballsRemaining = Math.max(0, totalBalls - input.battingBalls);
  const oversBowledFraction =
    totalBalls > 0 ? input.battingBalls / totalBalls : 0;

  const currentRunRate =
    input.battingBalls > 0
      ? (input.battingRuns / input.battingBalls) * 6
      : 0;

  const projectedScore =
    input.battingBalls > 0
      ? Math.round(currentRunRate * input.oversPerSide)
      : 0;

  let requiredRunRate: number | null = null;
  let parScore: number | null = null;
  let parDelta: number | null = null;
  let winPercent = 50;

  if (input.target != null && !input.isFirstInnings) {
    const runsNeeded = Math.max(0, input.target - input.battingRuns);
    requiredRunRate =
      ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : 0;

    // DLS-style par at this stage: target × resources_used / 100.
    const resourcesAvailable = resourcePercentage({
      ballsBowled: 0,
      totalBalls,
      wicketsLost: 0,
      totalWickets: input.totalWickets,
    });
    const resourcesRemaining = resourcePercentage({
      ballsBowled: input.battingBalls,
      totalBalls,
      wicketsLost: input.battingWickets,
      totalWickets: input.totalWickets,
    });
    const resourcesUsed = Math.max(
      0.0001,
      resourcesAvailable - resourcesRemaining,
    );
    const fracUsed = resourcesUsed / Math.max(0.0001, resourcesAvailable);
    parScore = Math.round((input.target - 1) * fracUsed);
    parDelta = input.battingRuns - parScore;

    if (input.battingRuns >= input.target) {
      winPercent = 99;
    } else if (
      ballsRemaining === 0 ||
      input.battingWickets >= input.totalWickets
    ) {
      winPercent = 1;
    } else {
      // Heuristic: combine run-rate gap and wickets-in-hand cushion.
      const rrGap = currentRunRate - requiredRunRate; // +ve helps chaser
      const wktsLeft = input.totalWickets - input.battingWickets;
      const wktsBonus = (wktsLeft / Math.max(1, input.totalWickets)) * 25; // up to +25
      const parBonus = (parDelta ?? 0) * 0.6;
      // Logistic-ish curve.
      const raw = 50 + rrGap * 4.5 + wktsBonus - 12 + parBonus;
      winPercent = clamp(Math.round(raw), 1, 99);
    }
  } else {
    // First innings — predict win % via projected total vs a notional
    // par projected total of (currentRunRate × oversPerSide) at the
    // ground. We treat this as 50% by default and lean it toward the
    // batting side when wickets are intact and run-rate is healthy.
    const wktsLeft = input.totalWickets - input.battingWickets;
    const wktsFrac = wktsLeft / Math.max(1, input.totalWickets);
    const expectedRunRate = 7.0; // rough average for short formats
    const rrGap = currentRunRate - expectedRunRate;
    const raw =
      50 +
      rrGap * 3.0 +
      (wktsFrac - 0.5) * 16 +
      (oversBowledFraction - 0.5) * 4 * (rrGap > 0 ? 1 : -1);
    winPercent = clamp(Math.round(raw), 5, 95);
  }

  return {
    ballsRemaining,
    oversRemainingText: formatOversText(ballsRemaining),
    currentRunRate: Math.round(currentRunRate * 100) / 100,
    requiredRunRate:
      requiredRunRate == null
        ? null
        : Math.round(requiredRunRate * 100) / 100,
    projectedScore,
    parScore,
    parDelta,
    winPercent,
  };
}
