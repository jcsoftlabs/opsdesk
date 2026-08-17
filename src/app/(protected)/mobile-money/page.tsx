import { requireUserOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfDay, addDays, parseDateParam, toDateParam } from "@/lib/businessWeek";
import { MobileMoneyForm } from "./MobileMoneyForm";
import { MobileMoneyExport } from "./MobileMoneyExport";

export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = { MONCASH: "MonCash", NATCASH: "NatCash" };
const OPERATION_TYPE_LABEL: Record<string, string> = {
  RETRAIT: "Retrait",
  DEPOT: "Dépôt",
  TRANSFERT: "Transfert",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });
const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", hour12: true });
const AMOUNT_FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function MobileMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; provider?: string; operationType?: string }>;
}) {
  await requireUserOrRedirect();
  const { date: dateParam, provider, operationType } = await searchParams;

  const day = parseDateParam(dateParam) ?? startOfDay(new Date());
  const dayEnd = addDays(day, 1);

  const where = {
    createdAt: { gte: day, lt: dayEnd },
    ...(provider ? { provider: provider as "MONCASH" | "NATCASH" } : {}),
    ...(operationType ? { operationType: operationType as "RETRAIT" | "DEPOT" | "TRANSFERT" } : {}),
  };

  const [openCashSession, operations] = await Promise.all([
    prisma.cashSession.findFirst({ where: { status: "OPEN" } }),
    prisma.mobileMoneyOperation.findMany({
      where,
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const total = operations.reduce((acc, o) => acc + Number(o.amount), 0);

  function buildHref(params: Record<string, string | undefined>) {
    const merged = { date: toDateParam(day), provider, operationType, ...params };
    const search = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    const qs = search.toString();
    return qs ? `/mobile-money?${qs}` : "/mobile-money";
  }

  const exportRows = operations.map((o) => ({
    date: `${DATE_FORMATTER.format(o.createdAt)} ${TIME_FORMATTER.format(o.createdAt)}`,
    provider: PROVIDER_LABEL[o.provider] ?? o.provider,
    operationType: OPERATION_TYPE_LABEL[o.operationType] ?? o.operationType,
    clientNumber: o.clientNumber,
    destinataireNumber: o.destinataireNumber ?? "",
    amount: o.amount.toString(),
    createdBy: o.createdBy.fullName,
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Registre MonCash / NatCash</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cahier des opérations agent (retraits, dépôts, transferts), exigé par la BRH. Montants en gourdes.
        </p>
      </div>

      {!openCashSession ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Aucune caisse commune ouverte. Chaque opération affecte la caisse (dépôt/transfert = entrée de
          cash, retrait = sortie) — demandez à un administrateur de l&apos;ouvrir avant de saisir.
        </p>
      ) : null}

      <MobileMoneyForm cashSessionOpen={Boolean(openCashSession)} />

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-neutral-900">Opérations du jour</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <a
              href={buildHref({ date: toDateParam(addDays(day, -1)) })}
              className="rounded border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50"
            >
              ← Jour précédent
            </a>
            <span className="font-medium text-neutral-900">{DATE_FORMATTER.format(day)}</span>
            <a
              href={buildHref({ date: toDateParam(addDays(day, 1)) })}
              className="rounded border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50"
            >
              Jour suivant →
            </a>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a
            href={buildHref({ provider: undefined })}
            aria-pressed={!provider}
            className={
              !provider
                ? "rounded bg-neutral-900 px-2 py-1 text-white"
                : "rounded border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50"
            }
          >
            Tous réseaux
          </a>
          {(["MONCASH", "NATCASH"] as const).map((p) => (
            <a
              key={p}
              href={buildHref({ provider: p })}
              aria-pressed={provider === p}
              className={
                provider === p
                  ? "rounded bg-neutral-900 px-2 py-1 text-white"
                  : "rounded border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50"
              }
            >
              {PROVIDER_LABEL[p]}
            </a>
          ))}
          <span className="mx-1 text-neutral-300">|</span>
          <a
            href={buildHref({ operationType: undefined })}
            aria-pressed={!operationType}
            className={
              !operationType
                ? "rounded bg-neutral-900 px-2 py-1 text-white"
                : "rounded border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50"
            }
          >
            Tous types
          </a>
          {(["RETRAIT", "DEPOT", "TRANSFERT"] as const).map((t) => (
            <a
              key={t}
              href={buildHref({ operationType: t })}
              aria-pressed={operationType === t}
              className={
                operationType === t
                  ? "rounded bg-neutral-900 px-2 py-1 text-white"
                  : "rounded border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50"
              }
            >
              {OPERATION_TYPE_LABEL[t]}
            </a>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-neutral-600">
            {operations.length} opération{operations.length > 1 ? "s" : ""} — total{" "}
            <span className="font-mono font-medium text-neutral-900">{AMOUNT_FORMATTER.format(total)} HTG</span>
          </p>
          <MobileMoneyExport filename={`moncash-natcash-${toDateParam(day)}`} rows={exportRows} />
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
              <tr>
                <th className="py-1 pr-2">Heure</th>
                <th className="py-1 pr-2">Réseau</th>
                <th className="py-1 pr-2">Type</th>
                <th className="py-1 pr-2">N° client</th>
                <th className="py-1 pr-2">N° destinataire</th>
                <th className="py-1 pr-2">Montant (HTG)</th>
                <th className="py-1 pr-2">Agent</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((o) => (
                <tr key={o.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-1 pr-2 text-neutral-700">{TIME_FORMATTER.format(o.createdAt)}</td>
                  <td className="py-1 pr-2 text-neutral-700">{PROVIDER_LABEL[o.provider] ?? o.provider}</td>
                  <td className="py-1 pr-2 text-neutral-700">{OPERATION_TYPE_LABEL[o.operationType] ?? o.operationType}</td>
                  <td className="py-1 pr-2 font-mono text-neutral-900">{o.clientNumber}</td>
                  <td className="py-1 pr-2 font-mono text-neutral-900">{o.destinataireNumber ?? "—"}</td>
                  <td className="py-1 pr-2 font-mono text-neutral-900">{AMOUNT_FORMATTER.format(Number(o.amount))}</td>
                  <td className="py-1 pr-2 text-neutral-700">{o.createdBy.fullName}</td>
                </tr>
              ))}
              {operations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-neutral-400">
                    Aucune opération pour ce jour.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
