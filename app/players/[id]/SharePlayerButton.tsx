"use client";

import { useEffect, useState } from "react";

type Props = {
  playerId: string;
  playerName: string;
  teamName: string;
};

export default function SharePlayerButton({
  playerId,
  playerName,
  teamName,
}: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "shared" | "error">(
    "idle",
  );
  const [shareUrl, setShareUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/players/${playerId}`);
    }
  }, [playerId]);

  useEffect(() => {
    if (status === "idle") return;
    const t = setTimeout(() => setStatus("idle"), 2200);
    return () => clearTimeout(t);
  }, [status]);

  async function handleShare() {
    const url =
      shareUrl ||
      (typeof window !== "undefined"
        ? `${window.location.origin}/players/${playerId}`
        : "");
    if (!url) return;

    const shareData = {
      title: `${playerName} — Hitachi Cricket`,
      text: `Check out ${playerName}'s career stats (${teamName}) on Hitachi Cricket.`,
      url,
    };

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share(shareData);
        setStatus("shared");
        return;
      } catch (err: any) {
        if (err && err.name === "AbortError") return;
      }
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  const label =
    status === "copied"
      ? "Link copied"
      : status === "shared"
        ? "Shared"
        : status === "error"
          ? "Copy failed"
          : "Share";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleShare}
        className="btn-ghost"
        aria-label={`Share ${playerName}'s profile`}
      >
        <ShareIcon />
        {label}
      </button>
      {shareUrl && status === "copied" && (
        <span
          className="max-w-[18rem] truncate text-xs text-slate-500"
          title={shareUrl}
        >
          {shareUrl}
        </span>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
