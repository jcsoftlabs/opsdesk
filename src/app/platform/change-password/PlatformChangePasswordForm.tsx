"use client";

import { useActionState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { platformChangePasswordAction, type PlatformChangePasswordState } from "./actions";

const initialState: PlatformChangePasswordState = {};

export function PlatformChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, formAction, pending] = useActionState(platformChangePasswordAction, initialState);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Changer le mot de passe</h1>
        {forced ? <p className="mt-1 text-sm text-neutral-500">Changement obligatoire avant de continuer.</p> : null}
      </div>

      <PasswordField name="currentPassword" label="Mot de passe actuel" required autoComplete="current-password" />

      <div>
        <PasswordField name="newPassword" label="Nouveau mot de passe" required minLength={10} autoComplete="new-password" />
        <p className="mt-1 text-xs text-neutral-500">Au moins 10 caractères.</p>
      </div>

      <PasswordField
        name="confirmPassword"
        label="Confirmer le nouveau mot de passe"
        required
        minLength={10}
        autoComplete="new-password"
      />

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-neutral-900 py-2 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
