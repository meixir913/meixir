import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Small key-value layer shared by the job feed and the centre scanner.
// - Redis over HTTP (Upstash) when configured: needed on Vercel, whose filesystem is read-only.
//   Accepts Upstash's own variable names or the KV_* names Vercel's Upstash integration sets.
// - Otherwise JSON files under DATA_DIR (default ./data), fine for a VPS or local dev.

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export const usingRedis = () => redisConfig() !== null;

async function redis<T>(command: (string | number)[]): Promise<T> {
  const r = redisConfig()!;
  const res = await fetch(r.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${r.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const data = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || data.error) throw new Error(`Storage error: ${data.error ?? res.status}`);
  return data.result as T;
}

const dataDir = () => process.env.DATA_DIR || path.join(process.cwd(), "data");
const fileFor = (key: string) => path.join(dataDir(), `${key.replace(/[^a-z0-9._-]+/gi, "_")}.json`);

async function readFileJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeFileJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

/** Reads one JSON document. */
export async function kvGet<T>(key: string): Promise<T | null> {
  if (usingRedis()) {
    const raw = await redis<string | null>(["GET", key]);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  return readFileJson<T>(fileFor(key));
}

/** Replaces one JSON document. */
export async function kvSet(key: string, value: unknown): Promise<void> {
  if (usingRedis()) {
    await redis(["SET", key, JSON.stringify(value)]);
    return;
  }
  await writeFileJson(fileFor(key), value);
}

/** Reads every field of a hash (a large map stored field by field). */
export async function hashGetAll<T>(key: string): Promise<Record<string, T>> {
  if (usingRedis()) {
    const flat = (await redis<string[] | null>(["HGETALL", key])) ?? [];
    const out: Record<string, T> = {};
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = JSON.parse(flat[i + 1]) as T;
    return out;
  }
  return (await readFileJson<Record<string, T>>(fileFor(key))) ?? {};
}

/** Writes or replaces some fields of a hash, leaving the others. */
export async function hashSet<T>(key: string, entries: Record<string, T>): Promise<void> {
  const pairs = Object.entries(entries);
  if (!pairs.length) return;
  if (usingRedis()) {
    // Keep each request comfortably under Upstash's request size limit.
    for (let i = 0; i < pairs.length; i += 500) {
      await redis(["HSET", key, ...pairs.slice(i, i + 500).flatMap(([f, v]) => [f, JSON.stringify(v)])]);
    }
    return;
  }
  const current = (await readFileJson<Record<string, T>>(fileFor(key))) ?? {};
  await writeFileJson(fileFor(key), { ...current, ...entries });
}

/** Replaces a whole hash. */
export async function hashReplace<T>(key: string, entries: Record<string, T>): Promise<void> {
  if (usingRedis()) {
    await redis(["DEL", key]);
    await hashSet(key, entries);
    return;
  }
  await writeFileJson(fileFor(key), entries);
}

const memoryCounters = new Map<string, { count: number; resetAt: number }>();

/** Increments a counter that expires after `ttlSeconds`; returns the new count. */
export async function kvIncr(key: string, ttlSeconds: number): Promise<number> {
  if (usingRedis()) {
    const count = await redis<number>(["INCR", key]);
    if (count === 1) await redis(["EXPIRE", key, ttlSeconds]);
    return count;
  }
  const now = Date.now();
  const entry = memoryCounters.get(key);
  if (!entry || entry.resetAt < now) {
    memoryCounters.set(key, { count: 1, resetAt: now + ttlSeconds * 1000 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

/** Deletes a document. */
export async function kvDel(key: string): Promise<void> {
  if (usingRedis()) {
    await redis(["DEL", key]);
    return;
  }
  await rm(fileFor(key), { force: true });
}
