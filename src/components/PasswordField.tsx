"use client";

import { useId, useState } from "react";

interface PasswordFieldProps {
  name: string;
  label: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}

export function PasswordField({ name, label, required, minLength, autoComplete }: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="block w-full rounded border border-neutral-300 bg-white px-3 py-2 pr-10 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-400 hover:text-neutral-600"
        >
          {visible ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 5.09A9.77 9.77 0 0112 5c5 0 9 4 10 7-.31.94-1.02 2.17-2.1 3.33M6.1 6.1C4.24 7.44 2.86 9.29 2 12c1 3 5 7 10 7 1.4 0 2.73-.31 3.9-.87"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"
              />
              <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
