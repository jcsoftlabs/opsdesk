"use client";

import { useActionState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { platformLoginAction, type PlatformLoginState } from "./actions";

const initialState: PlatformLoginState = {};

export function PlatformLoginForm() {
  const [state, formAction, pending] = useActionState(platformLoginAction, initialState);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-neutral-900">OpsDesk — Plateforme</h1>
        <p className="mt-1 text-sm text-neutral-500">Console opérateur, réservée à l&apos;équipe OpsDesk</p>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="username"
          className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
        />
      </div>

      <PasswordField name="password" label="Mot de passe" required autoComplete="current-password" />

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
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
