import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAuthenticated()) redirect("/admin/login");

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="card h-fit p-3 lg:sticky lg:top-20">
        <div className="px-2 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Admin
        </div>
        <nav className="flex flex-col gap-0.5 text-sm">
          <SideLink href="/admin">Dashboard</SideLink>
          <SideLink href="/admin/teams">Teams</SideLink>
          <SideLink href="/admin/players">Players</SideLink>
          <SideLink href="/admin/matches">Matches</SideLink>
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

function SideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}
