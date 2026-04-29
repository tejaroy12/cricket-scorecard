"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CurrentPlayer = {
  id: string;
  name: string;
  phone?: string | null;
  team: { id: string; name: string } | null;
  profileUrl: string;
} | null;

export function ProfileDialog({
  initial,
  open,
  onClose,
}: {
  initial: CurrentPlayer;
  open: boolean;
  onClose: () => void;
}) {
  const [me, setMe] = useState<CurrentPlayer>(initial);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMe(initial);
  }, [initial]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShareMsg(null);
    setTimeout(() => nameRef.current?.focus(), 30);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/players/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not find your profile.");
      setMe({
        id: j.id,
        name: j.name,
        team: j.team,
        profileUrl: j.profileUrl,
      });
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/players/session/logout", { method: "POST" });
      setMe(null);
      setName("");
      setPhone("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function shareProfile() {
    if (!me) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${me.profileUrl}`
        : me.profileUrl;
    const data = {
      title: `${me.name} — Hitachi Cricket`,
      text: `Check out ${me.name}'s career stats on Hitachi Cricket.`,
      url,
    };
    setShareMsg(null);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(data);
        setShareMsg("Shared!");
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Profile link copied!");
    } catch {
      setShareMsg(url);
    }
  }

  function viewProfile() {
    if (!me) return;
    router.push(me.profileUrl);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl ring-1 ring-slate-200"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-hitachi">
              Your profile
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {me ? `Hi, ${me.name}` : "Find your profile"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {me
                ? "Jump to your profile, share it, or switch to a different one."
                : "Enter your name and phone number — we'll match it to your player profile automatically."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {me ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Signed in as
              </div>
              <div className="mt-0.5 text-base font-bold text-slate-900">
                {me.name}
              </div>
              <div className="text-xs text-slate-500">
                {me.team?.name ?? "Free agent"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={viewProfile}
                disabled={busy}
                className="rounded-md bg-hitachi px-3 py-2 text-sm font-semibold text-white hover:bg-hitachi-dark"
              >
                Open my profile
              </button>
              <button
                type="button"
                onClick={shareProfile}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                <ShareIcon /> Share profile
              </button>
            </div>
            {shareMsg && (
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-100">
                {shareMsg}
              </div>
            )}

            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="w-full rounded-md px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Switch profile
            </button>
          </div>
        ) : (
          <form onSubmit={lookup} className="mt-4 space-y-3">
            <div>
              <label className="label">Full name</label>
              <input
                ref={nameRef}
                className="input"
                placeholder="e.g. Virat Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Phone number</label>
              <input
                className="input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9 +()-]*"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
                {error}
                {error.toLowerCase().includes("register") && (
                  <>
                    {" "}
                    <a
                      href="/register"
                      className="font-semibold underline"
                    >
                      Register here
                    </a>
                    .
                  </>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !name || !phone}
              className="w-full rounded-md bg-hitachi px-3 py-2 text-sm font-semibold text-white hover:bg-hitachi-dark disabled:opacity-50"
            >
              {busy ? "Looking up…" : "Continue to my profile"}
            </button>
            <div className="pt-1 text-center text-xs text-slate-500">
              New here?{" "}
              <a href="/register" className="font-semibold text-hitachi hover:underline">
                Register a profile
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
