import { AdminShell } from "./AdminShell";

export const dynamic = "force-dynamic";

export default function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
