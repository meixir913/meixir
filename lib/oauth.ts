import "server-only";
import { randomBytes } from "node:crypto";
import { findUserByEmail, type User } from "./auth";
import { kvDel, kvGet, kvSet } from "./kv";

// "Continue with Google / Facebook": the standard OAuth 2.0 authorisation code flow.
// Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET and/or FACEBOOK_APP_ID + FACEBOOK_APP_SECRET.

export type OAuthProvider = "google" | "facebook";
export const OAUTH_PROVIDERS: OAuthProvider[] = ["google", "facebook"];
export const OAUTH_STATE_COOKIE = "hm_oauth";
const STATE_MINUTES = 10;

const CONFIG = {
  google: {
    id: () => process.env.GOOGLE_CLIENT_ID,
    secret: () => process.env.GOOGLE_CLIENT_SECRET,
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile",
  },
  facebook: {
    id: () => process.env.FACEBOOK_APP_ID,
    secret: () => process.env.FACEBOOK_APP_SECRET,
    authorize: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "email,public_profile",
  },
} as const;

export const isOAuthProvider = (p: string): p is OAuthProvider => (OAUTH_PROVIDERS as string[]).includes(p);
export const oauthConfigured = (p: OAuthProvider) => Boolean(CONFIG[p].id() && CONFIG[p].secret());

/** Where the provider sends people back to. Register exactly this URL with Google / Facebook. */
export function redirectUri(p: OAuthProvider, req: Request) {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  return `${base}/api/auth/oauth/${p}/callback`;
}

/** Starts sign-in: remembers where to go afterwards and returns the provider's sign-in URL. */
export async function startOAuth(p: OAuthProvider, req: Request, next: string) {
  const state = randomBytes(24).toString("base64url");
  await kvSet(`oauth:${state}`, { provider: p, next, expiresAt: new Date(Date.now() + STATE_MINUTES * 60_000).toISOString() });
  const url = new URL(CONFIG[p].authorize);
  url.searchParams.set("client_id", CONFIG[p].id()!);
  url.searchParams.set("redirect_uri", redirectUri(p, req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CONFIG[p].scope);
  url.searchParams.set("state", state);
  if (p === "google") url.searchParams.set("prompt", "select_account");
  return { url: url.toString(), state };
}

export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
}

/** Checks the state, swaps the code for the person's profile, and returns it with the page to go to next. */
export async function finishOAuth(p: OAuthProvider, req: Request, fetcher: typeof fetch = fetch): Promise<{ profile: OAuthProfile; next: string }> {
  const params = new URL(req.url).searchParams;
  const state = params.get("state") ?? "";
  const cookieState = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];
  const saved = state ? await kvGet<{ provider: string; next: string; expiresAt: string }>(`oauth:${state}`) : null;
  if (state) await kvDel(`oauth:${state}`);
  if (!saved || saved.provider !== p || cookieState !== state || new Date(saved.expiresAt).getTime() < Date.now()) throw new OAuthError("That sign-in link has expired. Please try again.");
  if (params.get("error")) throw new OAuthError("Sign-in was cancelled.");
  const code = params.get("code");
  if (!code) throw new OAuthError("Sign-in was cancelled.");

  const profile = p === "google" ? await googleProfile(code, redirectUri(p, req), fetcher) : await facebookProfile(code, redirectUri(p, req), fetcher);
  if (!profile.email) throw new OAuthError("We couldn't get your email address. Allow access to your email, or sign up with email and password instead.");
  return { profile: { ...profile, email: profile.email.toLowerCase() }, next: saved.next };
}

async function googleProfile(code: string, redirect: string, fetcher: typeof fetch): Promise<OAuthProfile> {
  const tokenRes = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: CONFIG.google.id()!, client_secret: CONFIG.google.secret()!, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  if (!tokenRes.ok) throw new OAuthError("Google sign-in failed. Please try again.");
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const res = await fetcher("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) throw new OAuthError("Google sign-in failed. Please try again.");
  const u = (await res.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
  // Only a verified address can be matched to an existing account.
  return { id: u.sub, email: u.email_verified ? (u.email ?? "") : "", name: u.name ?? "" };
}

async function facebookProfile(code: string, redirect: string, fetcher: typeof fetch): Promise<OAuthProfile> {
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", CONFIG.facebook.id()!);
  tokenUrl.searchParams.set("client_secret", CONFIG.facebook.secret()!);
  tokenUrl.searchParams.set("redirect_uri", redirect);
  tokenUrl.searchParams.set("code", code);
  const tokenRes = await fetcher(tokenUrl);
  if (!tokenRes.ok) throw new OAuthError("Facebook sign-in failed. Please try again.");
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const me = new URL("https://graph.facebook.com/v19.0/me");
  me.searchParams.set("fields", "id,name,email");
  me.searchParams.set("access_token", access_token);
  const res = await fetcher(me);
  if (!res.ok) throw new OAuthError("Facebook sign-in failed. Please try again.");
  const u = (await res.json()) as { id: string; name?: string; email?: string };
  return { id: u.id, email: u.email ?? "", name: u.name ?? "" };
}

/** The account for this Google / Facebook login: already linked, matched by email, or new. */
export async function userForOAuth(p: OAuthProvider, profile: OAuthProfile): Promise<{ user: User; isNew: boolean }> {
  const linkedId = await kvGet<string>(`user-oauth:${p}:${profile.id}`);
  const linked = linkedId ? await kvGet<User>(`user:${linkedId}`) : null;
  if (linked) return { user: linked, isNew: false };

  let user = await findUserByEmail(profile.email);
  const isNew = !user;
  if (!user) {
    user = {
      id: randomBytes(9).toString("base64url"),
      email: profile.email,
      name: profile.name.slice(0, 100),
      // No password yet: they can set one later with "Forgot your password?".
      passwordHash: "",
      salt: "",
      createdAt: new Date().toISOString(),
    };
    await kvSet(`user-email:${user.email}`, user.id);
  }
  user.oauth = { ...user.oauth, [p]: profile.id };
  await kvSet(`user:${user.id}`, user);
  await kvSet(`user-oauth:${p}:${profile.id}`, user.id);
  return { user, isNew };
}

export class OAuthError extends Error {}
