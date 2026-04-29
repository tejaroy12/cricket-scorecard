"use client";

import { useEffect, useState } from "react";

type Kind = "FOUR" | "SIX";

/**
 * Full-screen celebration shown when a 4 or a 6 is scored.
 *
 * The parent passes `kind` along with a monotonically-increasing `nonce`
 * (typically a timestamp) — we use the nonce to retrigger the animation
 * even when the kind value is unchanged (back-to-back sixes etc.).
 *
 * The overlay disappears after ~1.6s on its own; clicking anywhere also
 * dismisses it so the admin can immediately resume scoring.
 */
export function BoundaryCelebration({
  kind,
  nonce,
  onDone,
}: {
  kind: Kind | null;
  nonce: number;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<Kind | null>(null);

  useEffect(() => {
    if (!kind) return;
    setActive(kind);
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      // Slight delay before clearing so the fade-out can finish.
      const t2 = setTimeout(() => {
        setActive(null);
        onDone();
      }, 250);
      return () => clearTimeout(t2);
    }, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, kind]);

  if (!active) return null;

  const isSix = active === "SIX";
  const word = isSix ? "SIX!" : "FOUR!";
  const tagline = isSix
    ? "Maximum! Out of the park."
    : "Boundary! Smashed to the rope.";
  const gradient = isSix
    ? "from-fuchsia-500 via-rose-500 to-amber-400"
    : "from-emerald-400 via-sky-400 to-indigo-400";
  const shadow = isSix ? "shadow-[0_0_120px_rgba(244,63,94,0.55)]" : "shadow-[0_0_120px_rgba(16,185,129,0.45)]";
  const emoji = isSix ? "💥🎉🏏" : "🏏🎉";

  return (
    <div
      role="status"
      aria-live="assertive"
      onClick={() => {
        setVisible(false);
        setTimeout(onDone, 200);
        setTimeout(() => setActive(null), 200);
      }}
      className={
        "fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 " +
        (visible ? "opacity-100" : "opacity-0 pointer-events-none")
      }
    >
      <div
        className={
          "relative flex flex-col items-center gap-3 rounded-3xl px-10 py-10 text-center " +
          shadow
        }
      >
        <div
          className={
            "select-none bg-gradient-to-br bg-clip-text text-[28vw] font-black leading-none tracking-tight text-transparent drop-shadow-[0_8px_30px_rgba(0,0,0,0.4)] sm:text-[18vw] md:text-[14rem] " +
            gradient +
            " " +
            (visible ? "animate-boundary-pop" : "")
          }
        >
          {word}
        </div>
        <div className="text-base font-semibold uppercase tracking-[0.4em] text-white/90">
          {tagline}
        </div>
        <div className="text-3xl">{emoji}</div>
      </div>

      {/*
       * Confetti / spark dots flying out from the centre. Pure CSS — each
       * dot has a slightly different angle and delay via inline style so
       * they look organic without bringing in a library.
       */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => {
          const angle = (i / 18) * Math.PI * 2;
          const x = Math.cos(angle) * 38;
          const y = Math.sin(angle) * 38;
          const colour = isSix
            ? ["#f43f5e", "#fb923c", "#f59e0b", "#a855f7"][i % 4]
            : ["#10b981", "#06b6d4", "#6366f1", "#84cc16"][i % 4];
          return (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 block h-3 w-3 rounded-full"
              style={{
                background: colour,
                animation: visible
                  ? `boundary-spark 1.2s cubic-bezier(0.22,0.61,0.36,1) ${i * 35}ms forwards`
                  : "none",
                ["--bx" as any]: `${x}vmax`,
                ["--by" as any]: `${y}vmax`,
              }}
            />
          );
        })}
      </div>

      <style jsx>{`
        @keyframes boundary-spark {
          0% {
            transform: translate(-50%, -50%) scale(0.4);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform:
              translate(calc(-50% + var(--bx)),
                        calc(-50% + var(--by)))
              scale(0.6);
            opacity: 0;
          }
        }
      `}</style>

      <style jsx global>{`
        @keyframes boundary-pop {
          0% {
            transform: scale(0.4) rotate(-6deg);
            opacity: 0;
          }
          40% {
            transform: scale(1.1) rotate(2deg);
            opacity: 1;
          }
          70% {
            transform: scale(0.96) rotate(-1deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }
        .animate-boundary-pop {
          animation: boundary-pop 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>
    </div>
  );
}
