"use client";

import { useActionState, useMemo, useState } from "react";
import { closeCashSessionAction, type CloseCashSessionState } from "./actions";

const initialState: CloseCashSessionState = {};
const FORMATTER = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CloseCashSessionFormProps {
  cashSessionId: string;
  expectedUsd: string;
  expectedHtg: string;
}

export function CloseCashSessionForm({ cashSessionId, expectedUsd, expectedHtg }: CloseCashSessionFormProps) {
  const [state, formAction, pending] = useActionState(closeCashSessionAction, initialState);
  const [countedUsd, setCountedUsd] = useState(expectedUsd);
  const [countedHtg, setCountedHtg] = useState(expectedHtg);

  const varianceUsd = useMemo(() => Number(countedUsd || 0) - Number(expectedUsd), [countedUsd, expectedUsd]);
  const varianceHtg = useMemo(() => Number(countedHtg || 0) - Number(expectedHtg), [countedHtg, expectedHtg]);
  const hasVariance = varianceUsd !== 0 || varianceHtg !== 0;

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
      <input type="hidden" name="cashSessionId" value={cashSessionId} />
      <h2 className="font-semibold text-neutral-900">Clôturer la caisse</h2>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-neutral-500">Solde théorique USD</p>
          <p className="font-mono text-base text-neutral-900">{FORMATTER.format(Number(expectedUsd))}</p>
        </div>
        <div>
          <p className="text-neutral-500">Solde théorique HTG</p>
          <p className="font-mono text-base text-neutral-900">{FORMATTER.format(Number(expectedHtg))}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="countedUsd" className="block text-sm font-medium text-neutral-700">
            Montant compté USD
          </label>
          <input
            id="countedUsd"
            name="countedUsd"
            inputMode="decimal"
            value={countedUsd}
            onChange={(e) => setCountedUsd(e.target.value)}
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="countedHtg" className="block text-sm font-medium text-neutral-700">
            Montant compté HTG
          </label>
          <input
            id="countedHtg"
            name="countedHtg"
            inputMode="decimal"
            value={countedHtg}
            onChange={(e) => setCountedHtg(e.target.value)}
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <p className={varianceUsd === 0 ? "text-neutral-500" : "font-medium text-red-600"}>
          Écart USD : {varianceUsd > 0 ? "+" : ""}
          {FORMATTER.format(varianceUsd)}
        </p>
        <p className={varianceHtg === 0 ? "text-neutral-500" : "font-medium text-red-600"}>
          Écart HTG : {varianceHtg > 0 ? "+" : ""}
          {FORMATTER.format(varianceHtg)}
        </p>
      </div>

      {hasVariance ? (
        <div>
          <label htmlFor="varianceNote" className="block text-sm font-medium text-neutral-700">
            Note d&apos;écart <span className="text-red-600">(obligatoire)</span>
          </label>
          <textarea
            id="varianceNote"
            name="varianceNote"
            required
            rows={2}
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>
      ) : (
        <input type="hidden" name="varianceNote" value="" />
      )}

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Clôture…" : "Clôturer la caisse"}
      </button>
    </form>
  );
}
