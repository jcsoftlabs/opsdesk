"use client";

import { useActionState } from "react";
import { verifyTransactionAction, type SimpleActionState } from "./actions";

const initialState: SimpleActionState = {};

export function VerifyButton({ transactionId }: { transactionId: string }) {
  const [state, formAction, pending] = useActionState(verifyTransactionAction, initialState);

  return (
    <div className="text-right">
      <form action={formAction}>
        <input type="hidden" name="transactionId" value={transactionId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "…" : "Vérifié"}
        </button>
      </form>
      {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
    </div>
  );
}
