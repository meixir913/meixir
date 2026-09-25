import { finderConfigured } from "@/lib/centres/find-website";
import { activeSources, mergeJobs } from "@/lib/feed/collect";
import { IMPORTS } from "@/lib/feed/imports";
import { SAMPLE_JOBS } from "@/lib/feed/sample";
import { PROVIDERS } from "@/lib/feed/sources/providers";
import { MAX_AGE_DAYS, loadFeed } from "@/lib/feed/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let feed = await loadFeed();
  // Add imported batches (duplicates of collected jobs are skipped).
  // Each imported job counts as new on the day it was posted, not the day it was imported.
  for (const batch of IMPORTS) for (const job of batch.jobs) feed = mergeJobs(feed, [job], job.postedAt || batch.importedAt).data;
  const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
  feed = { ...feed, jobs: feed.jobs.filter((j) => new Date(j.postedAt || j.collectedAt).getTime() >= cutoff).sort((a, b) => (b.postedAt || b.collectedAt).localeCompare(a.postedAt || a.collectedAt)) };
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
      imports: IMPORTS.map((b) => ({ source: b.source, importedAt: b.importedAt, count: b.jobs.length })),
    },
  });
}
