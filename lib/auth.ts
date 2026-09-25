import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { kvDel, kvGet, kvSet } from "./kv";

// Accounts: email + password, with sessions held in an httpOnly cookie.
// Passwords are hashed with scrypt; session and reset tokens are stored only as SHA-256 hashes.

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "hm_session";
export const SESSION_DAYS = 30;
const RESET_MINUTES = 60;

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export type PublicUser = Pick<User, "id" | "email" | "name" | "createdAt">;
export const publicUser = (u: User): PublicUser => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt });

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const normEmail = (email: string) => email.trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function hashPassword(password: string, salt: Buffer) {
  return (await scrypt(password.normalize("NFKC"), salt, 64)).toString("hex");
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters for your password.";
  if (password.length > 200) return "That password is too long.";
  return null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const id = await kvGet<string>(`user-email:${normEmail(email)}`);
  return id ? kvGet<User>(`user:${id}`) : null;
}

export const getUser = (id: string) => kvGet<User>(`user:${id}`);

export async function createUser(input: { name: string; email: string; password: string }): Promise<User> {
  const email = normEmail(input.email);
  if (!EMAIL_RE.test(email)) throw new AuthError("Enter a valid email address.");
  const problem = passwordProblem(input.password);
  if (problem) throw new AuthError(problem);
  if (await findUserByEmail(email)) throw new AuthError("An account with this email already exists. Log in instead.");
  const salt = randomBytes(16);
  const user: User = {
    id: randomBytes(9).toString("base64url"),
    email,
    name: input.name.trim().slice(0, 100),
    passwordHash: await hashPassword(input.password, salt),
    salt: salt.toString("hex"),
    createdAt: new Date().toISOString(),
  };
  await kvSet(`user:${user.id}`, user);
  await kvSet(`user-email:${email}`, user.id);
  return user;
}

/** Returns the user when the email and password match, otherwise null (same answer for both mistakes). */
export async function verifyLogin(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  // Hash anyway when the account doesn't exist, so timing doesn't reveal which emails are registered.
  const hash = await hashPassword(password, user ? Buffer.from(user.salt, "hex") : randomBytes(16));
  if (!user) return null;
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? user : null;
}

// ---------------------------------------------------------------- Sessions

export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await kvSet(`session:${sha256(token)}`, { userId, expiresAt: expires.toISOString() });
  return { token, expires };
}

export async function userFromSession(token: string | undefined | null): Promise<User | null> {
  if (!token) return null;
  const session = await kvGet<{ userId: string; expiresAt: string }>(`session:${sha256(token)}`);
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
  return getUser(session.userId);
}

export const endSession = (token: string) => kvDel(`session:${sha256(token)}`);

export function sessionCookie(token: string, expires: Date) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`;
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function tokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** For API routes: the signed-in user, or null. */
export const currentUser = (req: Request) => userFromSession(tokenFromRequest(req));

// ---------------------------------------------------------------- Password reset

export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await kvSet(`reset:${sha256(token)}`, { userId, expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000).toISOString() });
  return token;
}

export async function resetPassword(token: string, password: string): Promise<User> {
  const problem = passwordProblem(password);
  if (problem) throw new AuthError(problem);
  const key = `reset:${sha256(token)}`;
  const reset = await kvGet<{ userId: string; expiresAt: string }>(key);
  if (!reset || new Date(reset.expiresAt).getTime() < Date.now()) throw new AuthError("This reset link has expired. Ask for a new one.");
  const user = await getUser(reset.userId);
  if (!user) throw new AuthError("This reset link has expired. Ask for a new one.");
  const salt = randomBytes(16);
  user.salt = salt.toString("hex");
  user.passwordHash = await hashPassword(password, salt);
  await kvSet(`user:${user.id}`, user);
  await kvDel(key);
  return user;
}

export class AuthError extends Error {}
