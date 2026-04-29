"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileDialog } from "./ProfileDialog";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/matches", label: "Matches" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/register", label: "Register" },
];

type CurrentPlayer = {
  id: string;
  name: string;
  phone?: string | null;
  team: { id: string; name: string } | null;
  profileUrl: string;
} | null;

export function SiteHeader({
  loggedIn,
  currentPlayer,
}: {
  loggedIn: boolean;
  currentPlayer: CurrentPlayer;
}) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  function openProfile() {
    setOpen(false);
    setProfileOpen(true);
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-hitachi text-white shadow-sm">
              <span className="text-lg font-black tracking-tighter">H</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold uppercase tracking-widest text-hitachi">
                Hitachi
              </div>
              <div className="-mt-0.5 text-base font-semibold text-slate-900">
                Cricket League
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "nav-link" + (pathname === l.href ? " nav-link-active" : "")
                }
              >
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={openProfile}
              className={
                "nav-link" +
                (currentPlayer ? " nav-link-active" : "")
              }
            >
              {currentPlayer ? `Hi, ${firstName(currentPlayer.name)}` : "Profile"}
            </button>
          </nav>

          <div className="flex items-center gap-2">
            {loggedIn ? (
              <Link href="/admin" className="btn-dark hidden md:inline-flex">
                Admin Panel
              </Link>
            ) : (
              <Link
                href="/admin/login"
                className="btn-ghost hidden md:inline-flex"
              >
                Admin Login
              </Link>
            )}

            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 md:hidden"
            >
              {open ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
              )}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <nav className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
              <div className="flex flex-col gap-1">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={
                      "rounded-md px-3 py-2 text-sm font-medium " +
                      (pathname === l.href
                        ? "bg-hitachi/10 text-hitachi"
                        : "text-slate-700 hover:bg-slate-100")
                    }
                  >
                    {l.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={openProfile}
                  className={
                    "rounded-md px-3 py-2 text-left text-sm font-medium " +
                    (currentPlayer
                      ? "bg-hitachi/10 text-hitachi"
                      : "text-slate-700 hover:bg-slate-100")
                  }
                >
                  {currentPlayer ? (
                    <span className="flex items-center gap-2">
                      <UserIcon />
                      <span>
                        Profile · {firstName(currentPlayer.name)}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <UserIcon /> Profile
                    </span>
                  )}
                </button>
                <div className="my-2 border-t border-slate-100" />
                {loggedIn ? (
                  <Link
                    href="/admin"
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Admin Panel
                  </Link>
                ) : (
                  <Link
                    href="/admin/login"
                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    Admin Login
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}

        <style>{`
          .nav-link {
            padding: 0.4rem 0.8rem;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            color: rgb(51 65 85);
          }
          .nav-link:hover {
            background-color: rgb(241 245 249);
            color: rgb(15 23 42);
          }
          .nav-link-active {
            background-color: rgb(220 38 38 / 0.08);
            color: rgb(220 38 38);
          }
        `}</style>
      </header>

      <ProfileDialog
        initial={currentPlayer}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </>
  );
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] || full;
}

function UserIcon() {
  return (
    <svg
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
