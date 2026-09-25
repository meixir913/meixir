import { finderConfigured } from "@/lib/centres/find-website";
import { activeSources } from "@/lib/feed/collect";
import { SAMPLE_JOBS } from "@/lib/feed/sample";
import { PROVIDERS } from "@/lib/feed/sources/providers";
import { loadFeed } from "@/lib/feed/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await loadFeed();
  const sources = activeSources().map((s) => s.name);
  // Sample jobs until the first collection has run (provider websites are always on, so check the run).
  const sample = feed.jobs.length === 0 && !feed.lastCollectedAt;
  return Response.json({
    jobs: sample ? SAMPLE_JOBS : feed.jobs,
    sample,
    lastCollectedAt: feed.lastCollectedAt,
    // Latest run per source (runs are stored newest first).
    runs: Array.from(new Map(feed.runs.slice().reverse().map((r) => [r.source, r])).values()),
    channels: {
      jobBoards: { adzuna: sources.includes("Adzuna"), jooble: sources.includes("Jooble"), careerjet: sources.includes("Careerjet") },
      providers: PROVIDERS.map((p) => ({ name: p.name, website: p.website, connected: Boolean(p.feed) })),
      emailAlerts: Boolean(process.env.INBOUND_EMAIL_TOKEN),
      submitNeedsKey: Boolean(process.env.FEED_ADMIN_KEY),
      centreScanner: finderConfigured(),
    },
  });
}
