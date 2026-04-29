"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Routes where we want a distraction-free, full-bleed admin layout (no
 * sidebar). Right now this is the live-scoring console at
 * `/admin/matches/<id>` and the match-edit page nested under it.
 */
const FULL_BLEED = [
  /^\/admin\/matches\/[^/]+$/,
  /^\/admin\/matches\/[^/]+\/edit$/,
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const fullBleed = FULL_BLEED.some((re) => re.test(pathname));

  if (fullBleed) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
          <Link
            href="/admin/matches"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <BackIcon /> Back to matches
          </Link>
          <span className="hidden sm:inline-block uppercase tracking-widest">
            Scoring console
          </span>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="card h-fit p-3 lg:sticky lg:top-20">
        <div className="px-2 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Admin
        </div>
        <nav className="flex flex-col gap-0.5 text-sm">
          <SideLink href="/admin" pathname={pathname}>Dashboard</SideLink>
          <SideLink href="/admin/teams" pathname={pathname}>Teams</SideLink>
          <SideLink href="/admin/players" pathname={pathname}>Players</SideLink>
          <SideLink href="/admin/matches" pathname={pathname}>Matches</SideLink>
        </nav>
        <div className="mt-3 border-t border-slate-100 pt-3 px-1">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full rounded-md px-2 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SideLink({
  href,
  pathname,
  children,
}: {
  href: string;
  pathname: string;
  children: React.ReactNode;
}) {
  const active =
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={
        "rounded-md px-2 py-2 " +
        (active
          ? "bg-hitachi/10 text-hitachi font-medium"
          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900")
      }
    >
      {children}
    </Link>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}
