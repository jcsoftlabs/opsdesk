import { requirePlatformAdminOrRedirect } from "@/lib/platformAuth";
import { prisma } from "@/lib/db";
import { CreatePlatformAdminForm, PlatformAdminRowActions } from "./TeamActions";

export const dynamic = "force-dynamic";

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

export default async function PlatformTeamPage() {
  const currentAdmin = await requirePlatformAdminOrRedirect();

  const admins = await prisma.platformAdmin.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Équipe plateforme</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Comptes ayant accès à la console plateforme (`/platform`). Séparés des comptes clients.
        </p>
      </div>

      <CreatePlatformAdminForm />

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Créé le</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-900">{admin.fullName}</td>
                <td className="px-4 py-2 text-neutral-700">{admin.email}</td>
                <td className="px-4 py-2 text-neutral-500">{DATE_FORMATTER.format(admin.createdAt)}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      admin.active
                        ? "rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900"
                        : "rounded bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600"
                    }
                  >
                    {admin.active ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <PlatformAdminRowActions platformAdminId={admin.id} active={admin.active} isSelf={admin.id === currentAdmin.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
