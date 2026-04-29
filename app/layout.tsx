import type { Metadata } from "next";
import "./globals.css";
import { getCurrentPlayer } from "@/lib/playerSession";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Hitachi Cricket | Live Scores & Player Stats",
  description:
    "Internal cricket platform for Hitachi — live scoring, player profiles, team standings and match history.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentPlayer();
  const currentPlayer = me
    ? {
        id: me.id,
        name: me.name,
        phone: me.phone,
        team: me.team ? { id: me.team.id, name: me.team.name } : null,
        profileUrl: `/players/${me.id}`,
      }
    : null;

  return (
    <html lang="en">
      <body>
        <SiteHeader currentPlayer={currentPlayer} />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
            &copy; {new Date().getFullYear()} Hitachi Cricket League — Internal
            use only.
          </div>
        </footer>
      </body>
    </html>
  );
}
