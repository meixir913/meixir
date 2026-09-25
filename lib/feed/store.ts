import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FeedData } from "./types";

// The collected feed is one JSON document shared by every visitor.
// - Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) for serverless hosts like Vercel,
//   whose filesystem is read-only.
// - Otherwise a JSON file (JOB_FEED_FILE, default data/job-feed.json), fine for a VPS or local dev.

const EMPTY: FeedData = { jobs: [], runs: [], lastCollectedAt: null };
const KEY = "hiremeece:job-feed";

/** Keep the document small: drop jobs older than this and cap the total. */
export const MAX_AGE_DAYS = 30;
export const MAX_JOBS = 1500;

const redis = () =>
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }
    : null;

const filePath = () => process.env.JOB_FEED_FILE || path.join(process.cwd(), "data", "job-feed.json");

export async function loadFeed(): Promise<FeedData> {
  const r = redis();
  try {
    if (r) {
      const res = await fetch(`${r.url}/get/${KEY}`, { headers: { Authorization: `Bearer ${r.token}` }, cache: "no-store" });
      const { result } = (await res.json()) as { result: string | null };
      return result ? { ...EMPTY, ...(JSON.parse(result) as FeedData) } : EMPTY;
    }
    return { ...EMPTY, ...(JSON.parse(await readFile(filePath(), "utf8")) as FeedData) };
  } catch {
    return EMPTY;
  }
}

export async function saveFeed(data: FeedData): Promise<void> {
  const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
  const pruned: FeedData = {
    ...data,
    jobs: data.jobs
      .filter((j) => new Date(j.postedAt || j.collectedAt).getTime() >= cutoff)
      .sort((a, b) => (b.postedAt || b.collectedAt).localeCompare(a.postedAt || a.collectedAt))
      .slice(0, MAX_JOBS),
    runs: data.runs.slice(0, 50),
  };
  const r = redis();
  if (r) {
    const res = await fetch(`${r.url}/set/${KEY}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${r.token}` },
      body: JSON.stringify(pruned),
    });
    if (!res.ok) throw new Error(`Saving the job feed failed (${res.status})`);
    return;
  }
  await mkdir(path.dirname(filePath()), { recursive: true });
  await writeFile(filePath(), JSON.stringify(pruned));
}
