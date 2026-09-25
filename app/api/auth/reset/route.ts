import { AuthError, resetPassword } from "@/lib/auth";
import { signedIn } from "@/lib/auth-routes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { token, password } = (await req.json()) as { token?: string; password?: string };
  try {
    return await signedIn(await resetPassword(token ?? "", password ?? ""));
  } catch (err) {
    if (err instanceof AuthError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
