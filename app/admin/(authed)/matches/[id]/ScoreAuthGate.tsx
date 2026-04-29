"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/Spinner";

/**
 * Inline auth form rendered when someone lands on the scoring console
 * URL without admin credentials. Same admin/password pair as the
 * delete-match dialog and the "Score live" popup.
 */
export function ScoreAuthGate({
  matchId,
  matchTitle,
}: {
  matchId: string;
  matchTitle: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card overflow-hidden">
        <div className="hitachi-hero px-6 py-5 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
            Restricted · Live scoring
          </div>
          <h1 className="mt-1 text-xl font-bold">{matchTitle}</h1>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <p className="text-sm text-slate-600">
            Enter the admin credentials to open the scoring console for
            this match. Sessions last 7 days, so you won't need to type
            them again on the next match.
          </p>
          <div>
            <label className="label">Admin username</label>
            <input
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
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </div>
          )}
          <div className="flex justify-between">
            <Link
              href={`/matches/${matchId}`}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Just watch
            </Link>
            <button
              type="submit"
              disabled={busy || !username || !password}
              className="btn-primary"
            >
              {busy ? <Spinner label="Signing in…" /> : "Open scoring console"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
