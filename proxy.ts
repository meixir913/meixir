import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, userFromSession } from "@/lib/auth";

// Everything needs an account except the sign-in pages and a few endpoints that must work without one:
// links in emails, the scheduled jobs (protected by CRON_SECRET) and the inbound email webhook (token).
const PUBLIC_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];
const PUBLIC_API = ["/api/auth/", "/api/status", "/api/alerts/confirm", "/api/alerts/unsubscribe", "/api/cron/", "/api/ingest/"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const user = await userFromSession(req.cookies.get(SESSION_COOKIE)?.value);
  const isAuthPage = PUBLIC_PAGES.includes(pathname);

  if (isAuthPage) {
    // Already signed in: skip the login and sign-up forms.
    return user && pathname !== "/reset-password" ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip Next.js internals and static files (icons, manifest, service worker).
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|svg|ico|js|webmanifest|txt|xml)$).*)"],
};
