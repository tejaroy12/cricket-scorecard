import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Hitachi Cricket | Live Scores & Player Stats",
  description:
    "Internal cricket platform for Hitachi — live scoring, player profiles, team standings and match history.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loggedIn = isAuthenticated();

  return (
    <html lang="en">
      <body>
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
              <Link className="nav-link" href="/">Home</Link>
              <Link className="nav-link" href="/matches">Matches</Link>
              <Link className="nav-link" href="/teams">Teams</Link>
              <Link className="nav-link" href="/players">Players</Link>
              <Link className="nav-link" href="/leaderboard">Leaderboard</Link>
            </nav>

            <div className="flex items-center gap-2">
              {loggedIn ? (
                <Link href="/admin" className="btn-dark">
                  Admin Panel
                </Link>
              ) : (
                <Link href="/admin/login" className="btn-ghost">
                  Admin Login
                </Link>
              )}
            </div>
          </div>
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
          `}</style>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
            <div>
              &copy; {new Date().getFullYear()} Hitachi Cricket League — Internal
              use only.
            </div>
            <div>Built with Next.js + Prisma</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
