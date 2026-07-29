// Session par cookie httpOnly signé (§7.1, §10). Pas de table Session :
// le cookie porte l'identifiant utilisateur + une expiration, signés en HMAC.
// L'utilisateur est rechargé depuis la base à chaque requête protégée, ce qui
// permet une désactivation de compte à effet immédiat sans purge de session.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "opsdesk_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 heures, §7.1

interface SessionPayload {
  userId: string;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET manquant : impossible de signer les sessions");
  }
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(userId: string): { token: string; expiresAt: Date } {
  const exp = Date.now() + SESSION_TTL_MS;
  const payloadB64 = Buffer.from(JSON.stringify({ userId, exp } satisfies SessionPayload)).toString(
    "base64url",
  );
  const signature = sign(payloadB64);
  return { token: `${payloadB64}.${signature}`, expiresAt: new Date(exp) };
}

export function verifySessionToken(token: string | undefined | null): { userId: string } | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSignature = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.userId !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp < Date.now()) return null;

  return { userId: payload.userId };
}
