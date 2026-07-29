"use client";

import { useActionState } from "react";
import {
  deactivateUserAction,
  reactivateUserAction,
  resetPasswordAction,
  type SimpleActionState,
} from "./actions";

const initialState: SimpleActionState = {};

export function UserRowActions({ userId, active }: { userId: string; active: boolean }) {
  const [toggleState, toggleAction, togglePending] = useActionState(
    active ? deactivateUserAction : reactivateUserAction,
    initialState,
  );
  const [resetState, resetAction, resetPending] = useActionState(resetPasswordAction, initialState);

  return (
    <div className="space-y-1 text-right">
      <div className="flex justify-end gap-2">
        <form action={toggleAction}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            disabled={togglePending}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {active ? "Désactiver" : "Réactiver"}
          </button>
        </form>
        <form action={resetAction}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            disabled={resetPending}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Réinitialiser mot de passe
          </button>
        </form>
      </div>
      {toggleState.error ? <p className="text-xs text-red-600">{toggleState.error}</p> : null}
      {resetState.error ? <p className="text-xs text-red-600">{resetState.error}</p> : null}
      {resetState.temporaryPassword ? (
        <p className="rounded bg-amber-50 p-1 text-xs text-amber-800">
          Nouveau mot de passe : <code className="font-mono">{resetState.temporaryPassword}</code>
        </p>
      ) : null}
    </div>
  );
}
