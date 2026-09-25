import { notifyNewJobs, sendDigests } from "../alerts/service";
import { isEceJob, toFeedJob } from "./classify";
import { adzunaEnabled, careerjetEnabled, fetchAdzuna, fetchCareerjet, fetchJooble, joobleEnabled } from "./sources/job-boards";
import { PROVIDERS, fetchProvider } from "./sources/providers";
import { loadFeed, saveFeed } from "./store";
import type { FeedData, FeedJob, RawJob, SourceRun } from "./types";

const CONCURRENCY = 6;
const RUN_BUDGET_MS = 230_000; // the scheduled route may run for 300 seconds

interface Source {
  name: string;
  run: () => Promise<RawJob[]>;
}

/** Every automated source that is configured. Email alerts and pasted posts arrive through their own routes. */
export function activeSources(fetcher: typeof fetch = fetch): Source[] {
  const sources: Source[] = [];
  if (adzunaEnabled()) sources.push({ name: "Adzuna", run: () => fetchAdzuna(fetcher) });
  if (joobleEnabled()) sources.push({ name: "Jooble", run: () => fetchJooble(fetcher) });
  if (careerjetEnabled()) sources.push({ name: "Careerjet", run: () => fetchCareerjet(fetcher) });
  for (const p of PROVIDERS) if (p.feed) sources.push({ name: `${p.name} careers`, run: () => fetchProvider(p, fetcher) });
  return sources;
}

/**
 * Adds ECE jobs to the feed, skipping ones already there. A job seen on several channels keeps
 * its first entry, but a provider's own listing replaces a job-board copy of the same ad.
 */
export function mergeJobs(feed: FeedData, raws: RawJob[], now: string): { data: FeedData; added: FeedJob[]; found: number } {
  const byId = new Map(feed.jobs.map((j) => [j.id, j]));
  const added: FeedJob[] = [];
  let found = 0;
  for (const raw of raws) {
    if (!raw.title || !isEceJob(raw)) continue;
    found += 1;
    const job = toFeedJob(raw, now);
    const existing = byId.get(job.id);
    if (!existing) {
      byId.set(job.id, job);
      added.push(job);
    } else if (existing.sourceKind === "job-board" && job.sourceKind === "provider") {
      byId.set(job.id, { ...job, collectedAt: existing.collectedAt });
    }
  }
  return { data: { ...feed, jobs: Array.from(byId.values()) }, added, found };
}

/** One collection pass over all automated sources. Run it daily from a cron job. */
export async function collectAll(fetcher: typeof fetch = fetch) {
  const now = new Date().toISOString();
  let feed = await loadFeed();
  const runs: SourceRun[] = [];
  const allAdded: FeedJob[] = [];

  // Sources run a few at a time; any not started before the deadline wait for tomorrow's run.
  const deadline = Date.now() + RUN_BUDGET_MS;
  const results = new Map<string, { raws: RawJob[] } | { error: string } | null>();
  const queue = activeSources(fetcher);
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let source = queue.shift(); source; source = queue.shift()) {
        if (Date.now() > deadline) {
          results.set(source.name, null);
          continue;
        }
        try {
          results.set(source.name, { raws: await source.run() });
        } catch (err) {
          results.set(source.name, { error: err instanceof Error ? err.message : String(err) });
        }
      }
    }),
  );
  // Merge in a fixed order so job boards never replace a provider's own listing.
  for (const source of activeSources(fetcher)) {
    const r = results.get(source.name);
    if (r === undefined) continue;
    if (r === null) {
      runs.push({ source: source.name, ok: false, found: 0, added: 0, error: "skipped: out of time, runs again tomorrow", at: now });
    } else if ("error" in r) {
      runs.push({ source: source.name, ok: false, found: 0, added: 0, error: r.error, at: now });
    } else {
      const { data, added, found } = mergeJobs(feed, r.raws, now);
      feed = data;
      allAdded.push(...added);
      runs.push({ source: source.name, ok: true, found, added: added.length, at: now });
    }
  }

  feed = { ...feed, runs: [...runs, ...feed.runs], lastCollectedAt: now };
  await saveFeed(feed);

  // Alerts: instant notifications for what's new, then the daily email digest.
  const pushed = await notifyNewJobs(allAdded).catch(() => 0);
  const emailed = await sendDigests(feed.jobs).catch(() => 0);
  return { runs, total: feed.jobs.length, alerts: { pushed, emailed } };
}

/** Adds jobs that came in outside the daily run (forwarded alert emails, pasted posts). `found` counts ECE jobs only. */
export async function addJobs(raws: RawJob[]) {
  const now = new Date().toISOString();
  const { data, added, found } = mergeJobs(await loadFeed(), raws, now);
  await saveFeed(data);
  await notifyNewJobs(added).catch(() => 0);
  return { added, found };
}
