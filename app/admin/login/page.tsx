import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  if (isAuthenticated()) redirect("/admin");

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="card p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-hitachi text-white">
            <span className="text-xl font-black">H</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Login</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to manage teams, players & live scoring.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
