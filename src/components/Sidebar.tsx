"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import type { CurrentUser } from "@/lib/auth";

const ROLE_LABEL: Record<CurrentUser["role"], string> = {
  CASHIER: "Caissier",
  SUPERVISOR: "Superviseur",
  ADMIN: "Administrateur",
};

const NAV_ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-5.13a4 4 0 100-8 4 4 0 000 8zm6 1a4 4 0 100-8 4 4 0 000 8z"
      />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"
      />
    </svg>
  ),
  newTransaction: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  pending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  cash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6h18v12H3V6zm5 6a4 4 0 108 0 4 4 0 00-8 0z"
      />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V9m4 8V5m4 12v-6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  pricing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.66 0-3 .67-3 1.5S10.34 11 12 11s3 .67 3 1.5-1.34 1.5-3 1.5m0-6V6m0 8v1m0-9c1.11 0 2.08.402 2.599 1M8.5 3.5A9 9 0 1015.5 3.5" />
    </svg>
  ),
  mobileMoney: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 4h10a1 1 0 011 1v14a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1zm3 14h4"
      />
    </svg>
  ),
};

export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const navItems = [
    { href: "/dashboard", label: "Tableau de bord", icon: NAV_ICONS.dashboard },
    { href: "/transactions/new", label: "Nouvelle transaction", icon: NAV_ICONS.newTransaction },
    { href: "/transactions/pending", label: "Vérification / paiement", icon: NAV_ICONS.pending },
    { href: "/cash-session", label: "Caisse", icon: NAV_ICONS.cash },
    { href: "/mobile-money", label: "MonCash / NatCash", icon: NAV_ICONS.mobileMoney },
  ];
  if (user.role === "SUPERVISOR" || user.role === "ADMIN") {
    navItems.push({ href: "/reports", label: "Rapports", icon: NAV_ICONS.reports });
  }
  if (user.role === "ADMIN") {
    navItems.push(
      { href: "/admin/pricing", label: "Grille tarifaire", icon: NAV_ICONS.pricing },
      { href: "/admin/users", label: "Utilisateurs", icon: NAV_ICONS.users },
      { href: "/admin/audit-log", label: "Journal d'audit", icon: NAV_ICONS.audit },
    );
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="px-5 py-5">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-neutral-900">
          OpsDesk
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "flex items-center gap-3 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900"
                  : "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              }
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-200 p-3">
        <div className="rounded-md bg-neutral-50 px-3 py-2">
          <p className="truncate text-sm font-medium text-neutral-900">{user.fullName}</p>
          <p className="text-xs text-neutral-500">{ROLE_LABEL[user.role]}</p>
        </div>
        <form action={logoutAction} className="mt-2">
          <button
            type="submit"
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </aside>
  );
}
