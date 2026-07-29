import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { CurrentUser } from "@/lib/auth";

const ROLE_LABEL: Record<CurrentUser["role"], string> = {
  CASHIER: "Caissier",
  SUPERVISOR: "Superviseur",
  ADMIN: "Administrateur",
};

export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-semibold text-neutral-900">
          OpsDesk
        </Link>
        {user.role === "ADMIN" ? (
          <nav className="flex gap-4 text-sm text-neutral-600">
            <Link href="/admin/users" className="hover:text-neutral-900">
              Utilisateurs
            </Link>
            <Link href="/admin/audit-log" className="hover:text-neutral-900">
              Journal d&apos;audit
            </Link>
          </nav>
        ) : null}
      </div>
      <div className="flex items-center gap-4 text-sm text-neutral-600">
        <span>
          {user.fullName} · {ROLE_LABEL[user.role]}
        </span>
        <form action={logoutAction}>
          <button type="submit" className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-50">
            Se déconnecter
          </button>
        </form>
      </div>
    </header>
  );
}
