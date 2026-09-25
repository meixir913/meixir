import { kvGet, kvSet } from "../kv";
import type { FeedData } from "./types";

// The collected feed is one JSON document shared by every visitor (see lib/kv.ts for where it lives).

const EMPTY: FeedData = { jobs: [], runs: [], lastCollectedAt: null };
const KEY = "hiremeece:job-feed";

/** Keep the document small: drop jobs older than this and cap the total. */
export const MAX_AGE_DAYS = 30;
export const MAX_JOBS = 1500;

export async function loadFeed(): Promise<FeedData> {
  try {
    return { ...EMPTY, ...((await kvGet<FeedData>(KEY)) ?? {}) };
  } catch {
    return EMPTY;
  }
}

export async function saveFeed(data: FeedData): Promise<void> {
  const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
  await kvSet(KEY, {
    ...data,
    jobs: data.jobs
      .filter((j) => new Date(j.postedAt || j.collectedAt).getTime() >= cutoff)
      .sort((a, b) => (b.postedAt || b.collectedAt).localeCompare(a.postedAt || a.collectedAt))
      .slice(0, MAX_JOBS),
    runs: data.runs.slice(0, 50),
  });
}
