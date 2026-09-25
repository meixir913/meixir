import "server-only";
import { createSession, publicUser, sessionCookie, type User } from "./auth";

/** JSON response that signs the user in. */
export async function signedIn(user: User, status = 200) {
  const { token, expires } = await createSession(user.id);
  return Response.json({ user: publicUser(user) }, { status, headers: { "Set-Cookie": sessionCookie(token, expires) } });
}
