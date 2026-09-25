import { verifyLogin } from "@/lib/auth";
import { signedIn } from "@/lib/auth-routes";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = await rateLimit(req, "login");
  if (limited) return limited;
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  const user = await verifyLogin(email ?? "", password ?? "");
  if (!user) return Response.json({ error: "That email and password don't match. Check them and try again." }, { status: 401 });
  return signedIn(user);
}
