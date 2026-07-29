"use client";

import { useActionState, useState } from "react";
import { payTransactionAction, type SimpleActionState } from "./actions";

const initialState: SimpleActionState = {};

interface PayButtonProps {
  transactionId: string;
  netPayout: string;
  payoutCurrency: string;
  cashSessionOpen: boolean;
}

export function PayButton({ transactionId, netPayout, payoutCurrency, cashSessionOpen }: PayButtonProps) {
  const [state, formAction, pending] = useActionState(payTransactionAction, initialState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="text-right">
        <button
          type="button"
          disabled={!cashSessionOpen}
          onClick={() => setConfirming(true)}
          title={cashSessionOpen ? undefined : "Ouvrez votre caisse pour payer"}
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Payer
        </button>
        {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      </div>
    );
  }

  return (
    <div className="relative text-right">
      <div className="absolute right-0 top-0 z-10 w-56 rounded border border-neutral-300 bg-white p-2 text-right shadow-lg">
        <p className="text-xs text-neutral-700">
          Confirmer la remise de <strong>{netPayout} {payoutCurrency}</strong> ?
        </p>
        <form action={formAction} className="mt-2 flex justify-end gap-2">
          <input type="hidden" name="transactionId" value={transactionId} />
          <input type="hidden" name="confirmedNetPayout" value={netPayout} />
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {pending ? "…" : "Confirmer"}
          </button>
        </form>
        {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      </div>
    </div>
  );
}
