import { createSession, sessionCookie } from "@/lib/auth";
import { finishOAuth, isOAuthProvider, OAUTH_STATE_COOKIE, OAuthError, userForOAuth } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google / Facebook send the person back here after they sign in.
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  if (!isOAuthProvider(provider)) return Response.redirect(new URL("/login", url), 302);
  const clearState = `${OAUTH_STATE_COOKIE}=; Path=/api/auth/oauth; HttpOnly; SameSite=Lax; Max-Age=0`;
  try {
    const { profile, next } = await finishOAuth(provider, req);
    const { user, isNew } = await userForOAuth(provider, profile);
    const { token, expires } = await createSession(user.id);
    // New accounts start on My Profile, where they upload a resume.
    const headers = new Headers({ Location: new URL(isNew && next === "/" ? "/profile?welcome=1" : next, url).toString() });
    headers.append("Set-Cookie", sessionCookie(token, expires));
    headers.append("Set-Cookie", clearState);
    return new Response(null, { status: 302, headers });
  } catch (err) {
    const message = err instanceof OAuthError ? err.message : "Sign-in failed. Please try again.";
    const headers = new Headers({ Location: new URL(`/login?error=${encodeURIComponent(message)}`, url).toString() });
    headers.append("Set-Cookie", clearState);
    return new Response(null, { status: 302, headers });
  }
}
