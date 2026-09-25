import { isOAuthProvider, OAUTH_STATE_COOKIE, oauthConfigured, startOAuth } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Continue with Google / Facebook": sends the person to the provider's sign-in page.
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (!isOAuthProvider(provider)) return Response.redirect(new URL("/login", url), 302);
  if (!oauthConfigured(provider)) return Response.redirect(new URL(`/login?error=oauth-not-configured&provider=${provider}`, url), 302);

  const { url: signIn, state } = await startOAuth(provider, req, safeNext);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    headers: { Location: signIn, "Set-Cookie": `${OAUTH_STATE_COOKIE}=${state}; Path=/api/auth/oauth; HttpOnly; SameSite=Lax; Max-Age=600${secure}` },
  });
}
