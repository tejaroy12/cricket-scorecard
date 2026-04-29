import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { AdminShell } from "./AdminShell";

export const dynamic = "force-dynamic";

export default function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hard gate the entire admin surface — scoring a live match, editing
  // teams / players / rosters, deleting matches, etc. Spectators can
  // still watch the public match pages without logging in.
  if (!isAuthenticated()) {
    redirect("/admin/login");
  }
  return <AdminShell>{children}</AdminShell>;
}
