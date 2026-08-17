import Link from "next/link";
import { requirePlatformAdminOrRedirect } from "@/lib/platformAuth";
import { platformLogoutAction } from "../login/actions";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdminOrRedirect();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-white">
        <div className="px-5 py-5">
          <Link href="/platform" className="text-lg font-semibold tracking-tight text-neutral-900">
            OpsDesk
          </Link>
          <p className="text-xs text-neutral-500">Console plateforme</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          <Link
            href="/platform"
            className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            Organisations
          </Link>
          <Link
            href="/platform/organizations/new"
            className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            Nouvelle organisation
          </Link>
        </nav>
        <div className="border-t border-neutral-200 p-3">
          <div className="rounded-md bg-neutral-50 px-3 py-2">
            <p className="truncate text-sm font-medium text-neutral-900">{admin.fullName}</p>
            <p className="truncate text-xs text-neutral-500">{admin.email}</p>
          </div>
          <form action={platformLogoutAction} className="mt-2">
            <button
              type="submit"
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
