import { AdminShell } from "./AdminShell";

export const dynamic = "force-dynamic";

export default function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The admin surface (teams, players, leaderboard, match list) is
  // intentionally open. The scoring console and the delete-match
  // endpoint enforce credentials individually via popup dialogs.
  return <AdminShell>{children}</AdminShell>;
}
