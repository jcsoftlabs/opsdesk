"use client";

import { useActionState } from "react";
import { deactivateBureauAction, type DeactivateBureauState } from "./actions";

const initialState: DeactivateBureauState = {};

export function BureauRowActions({ bureauId, active }: { bureauId: string; active: boolean }) {
  const [state, action, pending] = useActionState(deactivateBureauAction, initialState);

  return (
    <div className="text-right">
      <form action={action}>
        <input type="hidden" name="bureauId" value={bureauId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {active ? "Désactiver" : "Réactiver"}
        </button>
      </form>
      {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
    </div>
  );
}
