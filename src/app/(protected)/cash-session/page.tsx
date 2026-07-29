import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeExpectedTotals } from "./actions";
import { OpenCashSessionForm } from "./OpenCashSessionForm";
import { CloseCashSessionForm } from "./CloseCashSessionForm";

// Données sensibles (soldes de caisse) : jamais de rendu mis en cache côté client.
export const dynamic = "force-dynamic";

const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

const REASON_LABEL: Record<string, string> = {
  TRANSFER_PAYOUT: "Remise de transfert",
  TRANSFER_FEE_IN: "Frais encaissés",
  DEPOSIT_IN: "Dépôt",
  EXPENSE: "Dépense",
  ADJUSTMENT: "Ajustement",
  OPENING: "Ouverture",
  OTHER: "Autre",
};

export default async function CashSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const user = await requireUserOrRedirect();
  const { userId: requestedUserId } = await searchParams;

  const canViewOthers = user.role === "SUPERVISOR" || user.role === "ADMIN";
  const targetUserId = canViewOthers && requestedUserId ? requestedUserId : user.id;

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, fullName: true },
  });

  const otherUsers = canViewOthers
    ? await prisma.user.findMany({
        where: { active: true },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      })
    : [];

  const openSession = targetUser
    ? await prisma.cashSession.findFirst({ where: { userId: targetUser.id, status: "OPEN" } })
    : null;

  const movements = openSession
    ? await prisma.cashMovement.findMany({
        where: { cashSessionId: openSession.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const expected = openSession ? await computeExpectedTotals(openSession.id) : null;

  const history = targetUser
    ? await prisma.cashSession.findMany({
        where: { userId: targetUser.id, status: "CLOSED" },
        orderBy: { closedAt: "desc" },
        take: 20,
      })
    : [];

  const isOwnSession = targetUserId === user.id;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="text-lg font-semibold text-neutral-900">Caisse</h1>

      {canViewOthers ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/cash-session"
            className={isOwnSession ? "rounded bg-neutral-900 px-3 py-1 text-white" : "rounded border border-neutral-300 px-3 py-1 text-neutral-600"}
          >
            Ma caisse
          </Link>
          {otherUsers
            .filter((u) => u.id !== user.id)
            .map((u) => (
              <Link
                key={u.id}
                href={`/cash-session?userId=${u.id}`}
                className={
                  targetUserId === u.id
                    ? "rounded bg-neutral-900 px-3 py-1 text-white"
                    : "rounded border border-neutral-300 px-3 py-1 text-neutral-600"
                }
              >
                {u.fullName}
              </Link>
            ))}
        </div>
      ) : null}

      {!isOwnSession && targetUser ? (
        <p className="text-sm text-neutral-500">Caisse de {targetUser.fullName} (lecture)</p>
      ) : null}

      {openSession && expected ? (
        <>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            Session ouverte le {DATE_FORMATTER.format(openSession.openedAt)} — fonds de départ{" "}
            {AMOUNT_FORMATTER.format(Number(openSession.openingUsd))} USD /{" "}
            {AMOUNT_FORMATTER.format(Number(openSession.openingHtg))} HTG
          </div>

          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Heure</th>
                  <th className="px-4 py-2">Motif</th>
                  <th className="px-4 py-2">Sens</th>
                  <th className="px-4 py-2">Montant</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2 text-neutral-500">{DATE_FORMATTER.format(m.createdAt)}</td>
                    <td className="px-4 py-2 text-neutral-700">{REASON_LABEL[m.reason]}</td>
                    <td className="px-4 py-2 text-neutral-700">{m.direction === "IN" ? "Entrée" : "Sortie"}</td>
                    <td className="px-4 py-2 text-neutral-900">
                      {AMOUNT_FORMATTER.format(Number(m.amount))} {m.currency}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                      Aucun mouvement pour l&apos;instant.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {isOwnSession ? (
            <CloseCashSessionForm
              cashSessionId={openSession.id}
              expectedUsd={expected.expectedUsd.toString()}
              expectedHtg={expected.expectedHtg.toString()}
            />
          ) : null}
        </>
      ) : isOwnSession ? (
        <OpenCashSessionForm />
      ) : (
        <p className="text-sm text-neutral-400">Aucune session ouverte.</p>
      )}

      {history.length > 0 ? (
        <section>
          <h2 className="font-medium text-neutral-900">Historique</h2>
          <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Clôturée le</th>
                  <th className="px-4 py-2">Compté USD</th>
                  <th className="px-4 py-2">Écart USD</th>
                  <th className="px-4 py-2">Compté HTG</th>
                  <th className="px-4 py-2">Écart HTG</th>
                  <th className="px-4 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2 text-neutral-500">{s.closedAt ? DATE_FORMATTER.format(s.closedAt) : "—"}</td>
                    <td className="px-4 py-2 text-neutral-900">{AMOUNT_FORMATTER.format(Number(s.countedUsd))}</td>
                    <td className={Number(s.varianceUsd) === 0 ? "px-4 py-2 text-neutral-500" : "px-4 py-2 font-medium text-red-600"}>
                      {AMOUNT_FORMATTER.format(Number(s.varianceUsd))}
                    </td>
                    <td className="px-4 py-2 text-neutral-900">{AMOUNT_FORMATTER.format(Number(s.countedHtg))}</td>
                    <td className={Number(s.varianceHtg) === 0 ? "px-4 py-2 text-neutral-500" : "px-4 py-2 font-medium text-red-600"}>
                      {AMOUNT_FORMATTER.format(Number(s.varianceHtg))}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{s.varianceNote ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
