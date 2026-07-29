import Link from "next/link";

interface CashSessionBannerProps {
  open: { openingUsd: string; openingHtg: string } | null;
  isAdmin: boolean;
}

export function CashSessionBanner({ open, isAdmin }: CashSessionBannerProps) {
  if (open) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-900">
        Caisse commune ouverte — fonds de départ {open.openingUsd} USD / {open.openingHtg} HTG
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-900">
        {isAdmin
          ? "Aucune caisse commune ouverte. Le paiement est bloqué."
          : "Aucune caisse commune ouverte. Demandez à un administrateur de l'ouvrir."}
      </p>
      {isAdmin ? (
        <Link href="/cash-session" className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white">
          Ouvrir la caisse
        </Link>
      ) : null}
    </div>
  );
}
