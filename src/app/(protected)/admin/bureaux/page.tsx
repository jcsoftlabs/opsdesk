import { requireRoleOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateBureauForm } from "./CreateBureauForm";
import { BureauRowActions } from "./BureauRowActions";

export const dynamic = "force-dynamic";

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

export default async function AdminBureauxPage() {
  const admin = await requireRoleOrRedirect(["ADMIN"]);

  const bureaux = await prisma.bureau.findMany({
    where: { organizationId: admin.organizationId },
    include: { _count: { select: { users: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Bureaux</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Un propriétaire peut avoir plusieurs bureaux, chacun avec sa propre caisse commune. La
          facturation se fait par bureau actif.
        </p>
      </div>

      <CreateBureauForm />

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Utilisateurs</th>
              <th className="px-4 py-2">Créé le</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {bureaux.map((b) => (
              <tr key={b.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-900">{b.name}</td>
                <td className="px-4 py-2 text-neutral-700">{b._count.users}</td>
                <td className="px-4 py-2 text-neutral-500">{DATE_FORMATTER.format(b.createdAt)}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      b.active
                        ? "rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900"
                        : "rounded bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600"
                    }
                  >
                    {b.active ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <BureauRowActions bureauId={b.id} active={b.active} />
                </td>
              </tr>
            ))}
            {bureaux.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  Aucun bureau pour l&apos;instant.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
