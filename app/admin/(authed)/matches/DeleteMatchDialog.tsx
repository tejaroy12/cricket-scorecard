"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteMatchButton({
  matchId,
  matchTitle,
}: {
  matchId: string;
  matchTitle: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
      {open && (
        <DeleteMatchDialog
          matchId={matchId}
          matchTitle={matchTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DeleteMatchDialog({
  matchId,
  matchTitle,
  onClose,
}: {
  matchId: string;
  matchTitle: string;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
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
      const r = await fetch(`/api/matches/${matchId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not delete match");
      onClose();
      router.refresh();
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
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900">
              Delete this match?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-800">{matchTitle}</span>{" "}
              and every ball, scorecard entry and roster row tied to it will be
              permanently removed. Confirm with admin credentials to proceed.
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
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete match"}
          </button>
        </div>
      </form>
    </div>
  );
}
