import { collectAll } from "@/lib/feed/collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Called once a day by the scheduler (vercel.json cron, or `curl` from any crontab).
// Vercel Cron sends "Authorization: Bearer $CRON_SECRET" automatically.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authorised = secret ? req.headers.get("authorization") === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
  if (!authorised) return Response.json({ error: "Set CRON_SECRET and send it as a Bearer token." }, { status: 401 });

  const result = await collectAll();
  return Response.json(result);
}
