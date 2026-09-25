import { isEceJob, toFeedJob } from "./classify";
import { adzunaEnabled, fetchAdzuna, fetchJooble, joobleEnabled } from "./sources/job-boards";
import { PROVIDERS, fetchProvider } from "./sources/providers";
import { loadFeed, saveFeed } from "./store";
import type { FeedData, FeedJob, RawJob, SourceRun } from "./types";

interface Source {
  name: string;
  run: () => Promise<RawJob[]>;
}

/** Every automated source that is configured. Email alerts and pasted posts arrive through their own routes. */
export function activeSources(fetcher: typeof fetch = fetch): Source[] {
  const sources: Source[] = [];
  if (adzunaEnabled()) sources.push({ name: "Adzuna", run: () => fetchAdzuna(fetcher) });
  if (joobleEnabled()) sources.push({ name: "Jooble", run: () => fetchJooble(fetcher) });
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

  for (const source of activeSources(fetcher)) {
    try {
      const raws = await source.run();
      const { data, added, found } = mergeJobs(feed, raws, now);
      feed = data;
      runs.push({ source: source.name, ok: true, found, added: added.length, at: now });
    } catch (err) {
      runs.push({ source: source.name, ok: false, found: 0, added: 0, error: err instanceof Error ? err.message : String(err), at: now });
    }
  }

  feed = { ...feed, runs: [...runs, ...feed.runs], lastCollectedAt: now };
  await saveFeed(feed);
  return { runs, total: feed.jobs.length };
}

/** Adds jobs that came in outside the daily run (forwarded alert emails, pasted posts). `found` counts ECE jobs only. */
export async function addJobs(raws: RawJob[]) {
  const now = new Date().toISOString();
  const { data, added, found } = mergeJobs(await loadFeed(), raws, now);
  await saveFeed(data);
  return { added, found };
}
