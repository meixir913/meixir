import { clearSessionCookie, endSession, tokenFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = tokenFromRequest(req);
  if (token) await endSession(token);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
