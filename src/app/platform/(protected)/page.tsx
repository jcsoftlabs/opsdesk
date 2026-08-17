import Link from "next/link";
import Decimal from "decimal.js";
import { requirePlatformAdminOrRedirect } from "@/lib/platformAuth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PlatformOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  await requirePlatformAdminOrRedirect();
  const { archived: showArchivedParam } = await searchParams;
  const showArchived = showArchivedParam === "1";

  const [organizations, invoiceTotals] = await Promise.all([
    prisma.organization.findMany({
      where: { archived: showArchived },
      include: {
        _count: { select: { bureaux: true, users: true } },
        bureaux: { where: { active: true }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invoice.groupBy({ by: ["status"], _sum: { totalAmount: true } }),
  ]);

  const activeOrgs = organizations.filter((o) => o.active).length;
  const totalActiveBureaux = organizations.reduce((acc, o) => acc + o.bureaux.length, 0);
  const estimatedMonthlyRevenue = organizations.reduce(
    (acc, o) => acc.plus(new Decimal(o.billingRatePerBureau.toString()).times(o.bureaux.length)),
    new Decimal(0),
  );
  const totalPaid = invoiceTotals.find((r) => r.status === "PAID")?._sum.totalAmount ?? 0;
  const totalDue = invoiceTotals.find((r) => r.status === "DUE")?._sum.totalAmount ?? 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Organisations</h1>
        <Link
          href="/platform/organizations/new"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Nouvelle organisation
        </Link>
      </div>

      {!showArchived ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Organisations actives</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {activeOrgs} / {organizations.length}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Bureaux actifs (total)</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{totalActiveBureaux}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Revenu mensuel estimé</p>
            <p className="mt-1 font-mono text-lg font-semibold text-neutral-900">
              {AMOUNT_FORMATTER.format(estimatedMonthlyRevenue.toNumber())}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Facturé — payé / dû</p>
            <p className="mt-1 font-mono text-sm font-semibold text-neutral-900">
              {AMOUNT_FORMATTER.format(Number(totalPaid))} / {AMOUNT_FORMATTER.format(Number(totalDue))}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 text-sm">
        <Link
          href="/platform"
          aria-pressed={!showArchived}
          className={
            !showArchived
              ? "rounded bg-neutral-900 px-3 py-1 text-white"
              : "rounded border border-neutral-300 px-3 py-1 text-neutral-600 hover:bg-neutral-50"
          }
        >
          Actives
        </Link>
        <Link
          href="/platform?archived=1"
          aria-pressed={showArchived}
          className={
            showArchived
              ? "rounded bg-neutral-900 px-3 py-1 text-white"
              : "rounded border border-neutral-300 px-3 py-1 text-neutral-600 hover:bg-neutral-50"
          }
        >
          Archivées
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Organisation</th>
              <th className="px-4 py-2">Bureaux actifs</th>
              <th className="px-4 py-2">Utilisateurs</th>
              <th className="px-4 py-2">Tarif / bureau</th>
              <th className="px-4 py-2">Montant mensuel estimé</th>
              <th className="px-4 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => {
              const activeBureaux = org.bureaux.length;
              const estimate = new Decimal(org.billingRatePerBureau.toString()).times(activeBureaux);
              return (
                <tr key={org.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/platform/organizations/${org.id}`} className="font-medium text-neutral-900 underline">
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-700">{activeBureaux}</td>
                  <td className="px-4 py-2 text-neutral-700">{org._count.users}</td>
                  <td className="px-4 py-2 text-neutral-700">
                    {AMOUNT_FORMATTER.format(Number(org.billingRatePerBureau))}
                  </td>
                  <td className="px-4 py-2 font-mono text-neutral-900">{AMOUNT_FORMATTER.format(estimate.toNumber())}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        org.active
                          ? "rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900"
                          : "rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900"
                      }
                    >
                      {org.active ? "Actif" : "Suspendu"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                  {showArchived ? "Aucune organisation archivée." : "Aucune organisation pour l'instant."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
