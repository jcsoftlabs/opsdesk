import { notFound } from "next/navigation";
import { requirePlatformAdminOrRedirect } from "@/lib/platformAuth";
import { prisma } from "@/lib/db";
import {
  ToggleOrganizationActiveButton,
  ArchiveOrganizationButton,
  UpdateOrganizationInfoForm,
  UpdateRateForm,
  GenerateInvoiceForm,
  MarkInvoicePaidButton,
  ToggleBureauActiveButton,
} from "./OrganizationActions";

export const dynamic = "force-dynamic";

const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

export default async function OrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; username?: string; password?: string }>;
}) {
  await requirePlatformAdminOrRedirect();
  const { id } = await params;
  const { created, username, password } = await searchParams;

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      bureaux: { orderBy: { createdAt: "asc" } },
      users: { orderBy: { createdAt: "asc" }, include: { bureau: { select: { name: true } } } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!organization) notFound();

  const activeBureauCount = organization.bureaux.filter((b) => b.active).length;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      {created && username && password ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Organisation créée. Compte administrateur <strong>{username}</strong> — mot de passe
          temporaire : <code className="font-mono">{password}</code> — à communiquer une seule fois,
          changement obligatoire à la première connexion.
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{organization.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {organization.phone ?? "Pas de téléphone renseigné"} · {activeBureauCount} bureau(x)
            actif(s) · {organization.users.length} utilisateur(s)
            {organization.archived ? " · archivée" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <ArchiveOrganizationButton organizationId={organization.id} archived={organization.archived} />
          <ToggleOrganizationActiveButton organizationId={organization.id} active={organization.active} />
        </div>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Informations</h2>
        <div className="mt-3">
          <UpdateOrganizationInfoForm
            organizationId={organization.id}
            currentName={organization.name}
            currentPhone={organization.phone ?? ""}
          />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Facturation</h2>
        <div className="mt-3">
          <UpdateRateForm organizationId={organization.id} currentRate={organization.billingRatePerBureau.toString()} />
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-medium text-neutral-700">Générer une facture</h3>
          <p className="mt-1 text-xs text-neutral-500">
            {activeBureauCount} bureau(x) actif(s) × {AMOUNT_FORMATTER.format(Number(organization.billingRatePerBureau))} =
            {" "}
            <strong>{AMOUNT_FORMATTER.format(activeBureauCount * Number(organization.billingRatePerBureau))} USD</strong>
          </p>
          <div className="mt-2">
            <GenerateInvoiceForm organizationId={organization.id} />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
              <tr>
                <th className="py-1 pr-2">Période</th>
                <th className="py-1 pr-2">Bureaux</th>
                <th className="py-1 pr-2">Montant</th>
                <th className="py-1 pr-2">Statut</th>
                <th className="py-1 pr-2" />
              </tr>
            </thead>
            <tbody>
              {organization.invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-1 pr-2 text-neutral-700">
                    {DATE_FORMATTER.format(inv.periodStart)} – {DATE_FORMATTER.format(inv.periodEnd)}
                  </td>
                  <td className="py-1 pr-2 text-neutral-700">{inv.bureauCount}</td>
                  <td className="py-1 pr-2 font-mono text-neutral-900">{AMOUNT_FORMATTER.format(Number(inv.totalAmount))}</td>
                  <td className="py-1 pr-2">
                    <span
                      className={
                        inv.status === "PAID"
                          ? "rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900"
                          : "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                      }
                    >
                      {inv.status === "PAID" ? "Payée" : "Due"}
                    </span>
                  </td>
                  <td className="py-1 pr-2">{inv.status === "DUE" ? <MarkInvoicePaidButton invoiceId={inv.id} /> : null}</td>
                </tr>
              ))}
              {organization.invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-neutral-400">
                    Aucune facture pour l&apos;instant.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Bureaux</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-1">Nom</th>
              <th className="py-1">Statut</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {organization.bureaux.map((b) => (
              <tr key={b.id} className="border-b border-neutral-100 last:border-0">
                <td className="py-1 text-neutral-900">{b.name}</td>
                <td className="py-1 text-neutral-700">{b.active ? "Actif" : "Désactivé"}</td>
                <td className="py-1 text-right">
                  <ToggleBureauActiveButton bureauId={b.id} active={b.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Utilisateurs</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-1">Nom</th>
              <th className="py-1">Identifiant</th>
              <th className="py-1">Rôle</th>
              <th className="py-1">Bureau</th>
            </tr>
          </thead>
          <tbody>
            {organization.users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                <td className="py-1 text-neutral-900">{u.fullName}</td>
                <td className="py-1 text-neutral-700">{u.username}</td>
                <td className="py-1 text-neutral-700">{u.role}</td>
                <td className="py-1 text-neutral-700">{u.bureau?.name ?? "Tous les bureaux"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
