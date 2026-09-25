import { currentUser, publicUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser(req);
  return user ? Response.json({ user: publicUser(user) }) : Response.json({ user: null }, { status: 401 });
}
