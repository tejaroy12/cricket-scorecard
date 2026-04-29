"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";

/**
 * Button that requires admin credentials before it lets you open the
 * scoring console for a live or scheduled match — same UX pattern as
 * the delete-match dialog.
 *
 * If the visitor is already signed in (`hc_session` cookie present and
 * valid), we skip the popup and navigate straight to the scoring page.
 */
export function ScoreLiveButton({
  matchId,
  status,
}: {
  matchId: string;
  status: "LIVE" | "SCHEDULED";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const label = status === "LIVE" ? "Score live" : "Manage";
  const colour =
    status === "LIVE"
      ? "bg-rose-600 hover:bg-rose-500"
      : "bg-slate-900 hover:bg-slate-800";

  async function onClick() {
    setChecking(true);
    try {
      // Skip the credential popup if the user already has a valid
      // admin session — saves them re-typing creds while scoring back-
      // to-back matches.
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (j?.admin) {
        router.push(`/admin/matches/${matchId}`);
        return;
      }
      setOpen(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={checking}
        className={
          "rounded-md px-3 py-1 text-xs font-medium text-white disabled:opacity-60 " +
          colour
        }
      >
        {checking ? "…" : label}
      </button>
      {open && (
        <ScoreLoginDialog
          matchId={matchId}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            router.push(`/admin/matches/${matchId}`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ScoreLoginDialog({
  matchId,
  onClose,
  onSuccess,
}: {
  matchId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    userRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Sign-in failed");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={() => !busy && onClose()}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl ring-1 ring-slate-200"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-hitachi/10 text-hitachi">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900">
              Confirm admin to score
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Live scoring is restricted. Enter the admin credentials to
              open the scoring console for this match.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Admin username</label>
            <input
              ref={userRef}
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Admin password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !username || !password}
            className="rounded-md bg-hitachi px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-hitachi-dark disabled:opacity-50"
          >
            {busy ? <Spinner label="Signing in…" /> : "Open scoring console"}
          </button>
        </div>
      </form>
    </div>
  );
}
