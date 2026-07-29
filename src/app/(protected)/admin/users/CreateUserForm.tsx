"use client";

import { useActionState } from "react";
import { createUserAction, type CreateUserState } from "./actions";

const initialState: CreateUserState = {};

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="font-medium text-neutral-900">Nouvel utilisateur</h2>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="fullName" className="block text-xs font-medium text-neutral-600">
            Nom complet
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="username" className="block text-xs font-medium text-neutral-600">
            Nom d&apos;utilisateur
          </label>
          <input
            id="username"
            name="username"
            required
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="role" className="block text-xs font-medium text-neutral-600">
            Rôle
          </label>
          <select
            id="role"
            name="role"
            defaultValue="CASHIER"
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          >
            <option value="CASHIER">Caissier</option>
            <option value="SUPERVISOR">Superviseur</option>
            <option value="ADMIN">Administrateur</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Création…" : "Créer"}
        </button>
      </form>

      {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
      {state.temporaryPassword ? (
        <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-800">
          Compte <strong>{state.createdUsername}</strong> créé. Mot de passe temporaire :{" "}
          <code className="font-mono">{state.temporaryPassword}</code> — à communiquer une seule
          fois, changement obligatoire à la première connexion.
        </p>
      ) : null}
    </div>
  );
}
