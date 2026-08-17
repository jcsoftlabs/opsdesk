import { requireUserOrRedirect, requireBureauId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeExpectedTotals } from "./actions";
import { OpenCashSessionForm } from "./OpenCashSessionForm";
import { CloseCashSessionForm } from "./CloseCashSessionForm";
import { TopUpForm } from "./TopUpForm";

// Données sensibles (soldes de caisse) : jamais de rendu mis en cache côté client.
export const dynamic = "force-dynamic";

const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", hour12: true });

const REASON_LABEL: Record<string, string> = {
  TRANSFER_PAYOUT: "Remise de transfert",
  TRANSFER_FEE_IN: "Frais encaissés",
  DEPOSIT_IN: "Dépôt",
  EXPENSE: "Dépense",
  ADJUSTMENT: "Ajustement",
  OPENING: "Ouverture",
  CASH_TOPUP: "Apport de liquidités",
  MOBILE_MONEY_DEPOSIT: "MonCash/NatCash — Dépôt",
  MOBILE_MONEY_TRANSFER: "MonCash/NatCash — Transfert",
  MOBILE_MONEY_WITHDRAWAL: "MonCash/NatCash — Retrait",
  OTHER: "Autre",
};

export default async function CashSessionPage() {
  const user = await requireUserOrRedirect();
  const bureauId = await requireBureauId(user);
  const isAdmin = user.role === "ADMIN";

  const openSession = await prisma.cashSession.findFirst({
    where: { bureauId, status: "OPEN" },
    include: { openedBy: { select: { fullName: true } } },
  });

  const movements = openSession
    ? await prisma.cashMovement.findMany({
        where: { cashSessionId: openSession.id },
        include: { createdBy: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const expected = openSession ? await computeExpectedTotals(openSession.id) : null;

  const history = await prisma.cashSession.findMany({
    where: { bureauId, status: "CLOSED" },
    include: { openedBy: { select: { fullName: true } } },
    orderBy: { closedAt: "desc" },
    take: 20,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Caisse commune</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Caisse partagée entre les agents de transaction. Seul un administrateur peut l&apos;ouvrir,
          la clôturer ou y ajouter des liquidités.
        </p>
      </div>

      {openSession && expected ? (
        <>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            Ouverte par {openSession.openedBy.fullName} le {DATE_FORMATTER.format(openSession.openedAt)} — fonds
            de départ {AMOUNT_FORMATTER.format(Number(openSession.openingUsd))} USD /{" "}
            {AMOUNT_FORMATTER.format(Number(openSession.openingHtg))} HTG
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-neutral-500">Solde théorique USD</p>
              <p className="font-mono text-lg text-neutral-900">{AMOUNT_FORMATTER.format(expected.expectedUsd.toNumber())}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-neutral-500">Solde théorique HTG</p>
              <p className="font-mono text-lg text-neutral-900">{AMOUNT_FORMATTER.format(expected.expectedHtg.toNumber())}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Heure</th>
                  <th className="px-4 py-2">Motif</th>
                  <th className="px-4 py-2">Agent</th>
                  <th className="px-4 py-2">Sens</th>
                  <th className="px-4 py-2">Montant</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2 text-neutral-500">{DATE_FORMATTER.format(m.createdAt)}</td>
                    <td className="px-4 py-2 text-neutral-700">{REASON_LABEL[m.reason]}</td>
                    <td className="px-4 py-2 text-neutral-700">{m.createdBy.fullName}</td>
                    <td className="px-4 py-2 text-neutral-700">{m.direction === "IN" ? "Entrée" : "Sortie"}</td>
                    <td className="px-4 py-2 text-neutral-900">
                      {AMOUNT_FORMATTER.format(Number(m.amount))} {m.currency}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                      Aucun mouvement pour l&apos;instant.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {isAdmin ? (
            <>
              <TopUpForm />
              <CloseCashSessionForm
                cashSessionId={openSession.id}
                expectedUsd={expected.expectedUsd.toString()}
                expectedHtg={expected.expectedHtg.toString()}
              />
            </>
          ) : null}
        </>
      ) : isAdmin ? (
        <OpenCashSessionForm />
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Aucune caisse commune ouverte. Demandez à un administrateur de l&apos;ouvrir.
        </p>
      )}

      {history.length > 0 ? (
        <section>
          <h2 className="font-medium text-neutral-900">Historique</h2>
          <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Clôturée le</th>
                  <th className="px-4 py-2">Ouverte par</th>
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
                    <td className="px-4 py-2 text-neutral-700">{s.openedBy.fullName}</td>
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
