import { AuthError, createUser } from "@/lib/auth";
import { signedIn } from "@/lib/auth-routes";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = await rateLimit(req, "signup");
  if (limited) return limited;
  const { name, email, password } = (await req.json()) as { name?: string; email?: string; password?: string };
  if (!name?.trim()) return Response.json({ error: "Enter your name." }, { status: 400 });
  try {
    return await signedIn(await createUser({ name, email: email ?? "", password: password ?? "" }), 201);
  } catch (err) {
    if (err instanceof AuthError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
