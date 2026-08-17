import { cookies } from "next/headers";
import { requireUserOrRedirect, ACTIVE_BUREAU_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserOrRedirect();

  // Sélecteur de bureau (§15/M10) : uniquement pertinent pour un utilisateur
  // org-wide (bureauId = null) — un utilisateur de bureau n'en change jamais.
  const bureaux = user.bureauId
    ? []
    : await prisma.bureau.findMany({
        where: { organizationId: user.organizationId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
  const activeBureauId = user.bureauId ? null : ((await cookies()).get(ACTIVE_BUREAU_COOKIE_NAME)?.value ?? null);

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar user={user} bureaux={bureaux} activeBureauId={activeBureauId} />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
