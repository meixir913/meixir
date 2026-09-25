import { activeSources } from "@/lib/feed/collect";
import { SAMPLE_JOBS } from "@/lib/feed/sample";
import { PROVIDERS } from "@/lib/feed/sources/providers";
import { loadFeed } from "@/lib/feed/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await loadFeed();
  const sources = activeSources().map((s) => s.name);
  const sample = feed.jobs.length === 0 && sources.length === 0;
  return Response.json({
    jobs: sample ? SAMPLE_JOBS : feed.jobs,
    sample,
    lastCollectedAt: feed.lastCollectedAt,
    // Latest run per source (runs are stored newest first).
    runs: Array.from(new Map(feed.runs.slice().reverse().map((r) => [r.source, r])).values()),
    channels: {
      jobBoards: { adzuna: sources.includes("Adzuna"), jooble: sources.includes("Jooble") },
      providers: PROVIDERS.map((p) => ({ name: p.name, website: p.website, connected: Boolean(p.feed) })),
      emailAlerts: Boolean(process.env.INBOUND_EMAIL_TOKEN),
      submitNeedsKey: Boolean(process.env.FEED_ADMIN_KEY),
    },
  });
}
