import { AuthError, createUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = await rateLimit(req, "signup");
  if (limited) return limited;
  const { name, email, password } = (await req.json()) as { name?: string; email?: string; password?: string };
  if (!name?.trim()) return Response.json({ error: "Enter your name." }, { status: 400 });
  try {
    // The account is created signed out: the person then logs in with their new details.
    const user = await createUser({ name, email: email ?? "", password: password ?? "" });
    return Response.json({ ok: true, email: user.email }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
