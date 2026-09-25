import { cronAuthorised } from "@/lib/cron-auth";
import { runCentres } from "@/lib/centres/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Hourly: refreshes the ACECQA register weekly, finds centre websites, and checks careers pages.
export async function GET(req: Request) {
  if (!cronAuthorised(req)) return Response.json({ error: "Set CRON_SECRET and send it as a Bearer token." }, { status: 401 });
  return Response.json(await runCentres({ timeBudgetMs: 240_000 }));
}
