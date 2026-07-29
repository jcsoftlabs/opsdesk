"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-neutral-900">OpsDesk</h1>
        <p className="mt-1 text-sm text-neutral-500">Connexion</p>
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-neutral-700">
          Nom d&apos;utilisateur
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoFocus
          autoComplete="username"
          className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
        />
      </div>

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
