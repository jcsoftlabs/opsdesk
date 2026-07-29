import { randomBytes } from "node:crypto";

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Génère un mot de passe temporaire lisible, ≥ 10 caractères (§10). */
export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return result;
}

export const MIN_PASSWORD_LENGTH = 10;

/** Durée de verrouillage après 10 échecs de connexion (§10).
 * Non spécifiée par le cahier — valeur par défaut à confirmer avec le client. */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const MAX_FAILED_LOGIN_ATTEMPTS = 10;
