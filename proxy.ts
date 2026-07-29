// Next.js 16 : middleware.ts est remplacé par proxy.ts (runtime nodejs uniquement).
// Ce garde-fou est un confort de navigation (redirection rapide sans DB) — le
// contrôle d'accès autoritaire reste dans requireUserOrRedirect/requireRoleOrRedirect
// et dans chaque Server Action (§6 : "masquer un bouton n'est pas un contrôle d'accès").
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
