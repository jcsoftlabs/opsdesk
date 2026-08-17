import { requirePlatformAdminOrRedirect } from "@/lib/platformAuth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium", hour12: true });

export default async function PlatformAuditLogPage() {
  await requirePlatformAdminOrRedirect();

  const entries = await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { platformAdmin: { select: { fullName: true, email: true } } },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-8">
      <h1 className="text-lg font-semibold text-neutral-900">Journal d&apos;audit plateforme</h1>
      <p className="text-sm text-neutral-500">
        200 dernières entrées. Registre en lecture seule (append-only, imposé en base) — qui a créé,
        suspendu, ou modifié quelle organisation, et quand.
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Opérateur</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entité</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-neutral-100 last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{DATE_FORMATTER.format(entry.createdAt)}</td>
                <td className="px-4 py-2 text-neutral-900">{entry.platformAdmin.fullName}</td>
                <td className="px-4 py-2 font-mono text-xs text-neutral-700">{entry.action}</td>
                <td className="px-4 py-2 text-neutral-500">
                  {entry.entityType}#{entry.entityId.slice(0, 8)}
                </td>
              </tr>
            ))}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  Aucune entrée pour l&apos;instant.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
