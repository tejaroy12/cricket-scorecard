"use client";

import { predict, PredictorInput } from "@/lib/predictor";

/**
 * Compact "win % / par score" panel inspired by Crex's match predictor.
 *
 * The numbers come from the lightweight model in `lib/predictor.ts` —
 * not real DLS, but close enough to give a rough feel for the state of
 * the chase.
 */
export function MatchPredictor({
  battingTeamName,
  bowlingTeamName,
  input,
}: {
  battingTeamName: string;
  bowlingTeamName: string;
  input: PredictorInput;
}) {
  const out = predict(input);
  const win = out.winPercent;
  const otherWin = Math.max(1, Math.min(99, 100 - win));

  const tone =
    win >= 65
      ? "from-emerald-500 to-emerald-600"
      : win >= 45
      ? "from-sky-500 to-indigo-600"
      : "from-rose-500 to-rose-600";

  const headlineLabel = input.isFirstInnings
    ? "Projected"
    : input.target == null
    ? ""
    : `Target ${input.target}`;

  return (
    <div className="card overflow-hidden">
      <div className="hitachi-hero flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-white">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
          Match predictor · DLS-style
        </div>
        {headlineLabel && (
          <div className="text-xs text-white/85">{headlineLabel}</div>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500">
            <span className="truncate">{battingTeamName}</span>
            <span className="truncate text-right">{bowlingTeamName}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-2xl font-black tabular-nums text-slate-900">
            <span>{win}%</span>
            <span className="text-slate-400">{otherWin}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={"h-full bg-gradient-to-r " + tone}
              style={{ width: `${win}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Current RR" value={out.currentRunRate.toFixed(2)} />
          {out.requiredRunRate != null ? (
            <Stat
              label="Required RR"
              value={out.requiredRunRate.toFixed(2)}
              accent={
                out.currentRunRate >= out.requiredRunRate
                  ? "emerald"
                  : "rose"
              }
            />
          ) : (
            <Stat label="Projected" value={String(out.projectedScore)} />
          )}
          <Stat label="Overs left" value={out.oversRemainingText} />
          {out.parScore != null && out.parDelta != null ? (
            <Stat
              label={`Par (DLS)`}
              value={String(out.parScore)}
              accent={out.parDelta >= 0 ? "emerald" : "rose"}
              caption={
                out.parDelta === 0
                  ? "level with par"
                  : out.parDelta > 0
                  ? `+${out.parDelta} ahead`
                  : `${out.parDelta} behind`
              }
            />
          ) : (
            <Stat
              label="Wickets in hand"
              value={String(
                Math.max(0, input.totalWickets - input.battingWickets),
              )}
            />
          )}
        </div>

        <p className="text-[11px] italic text-slate-400">
          Heuristic predictor — not the official DLS. Updates as each ball
          is recorded.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: "emerald" | "rose";
}) {
  const valColour =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "rose"
      ? "text-rose-700"
      : "text-slate-900";
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-black tabular-nums ${valColour}`}>
        {value}
      </div>
      {caption && (
        <div className="text-[11px] text-slate-500">{caption}</div>
      )}
    </div>
  );
}
