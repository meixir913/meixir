import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dedupeKey, detectState, isEceJob, roleLevel } from "@/lib/feed/classify";
import { collectAll, mergeJobs } from "@/lib/feed/collect";
import { fetchAdzuna } from "@/lib/feed/sources/job-boards";
import { PROVIDERS, extractJobPostings, fetchProvider, parseRss, type Provider } from "@/lib/feed/sources/providers";
import { loadFeed } from "@/lib/feed/store";
import type { RawJob } from "@/lib/feed/types";

const raw = (over: Partial<RawJob>): RawJob => ({
  title: "Diploma Educator",
  employer: "Wattle Grove Early Learning",
  location: "Parramatta NSW",
  salary: "",
  employmentType: "",
  url: "https://example.com/1",
  description: "Long day care centre",
  sourceKind: "job-board",
  source: "Adzuna",
  postedAt: new Date().toISOString(),
  ...over,
});

/** A fetch stand-in that answers from a URL → body map. */
const fakeFetch = (routes: Record<string, unknown>) =>
  vi.fn(async (input: string | URL | Request) => {
    const url = input.toString();
    const key = Object.keys(routes)
      .filter((k) => url.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (!key) return new Response("not found", { status: 404 });
    const body = routes[key];
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;

describe("classify", () => {
  it("keeps early childhood roles and drops lookalikes", () => {
    expect(isEceJob(raw({ title: "Early Childhood Teacher" }))).toBe(true);
    expect(isEceJob(raw({ title: "OSHC Educator" }))).toBe(true);
    expect(isEceJob(raw({ title: "Cook", description: "Cook for our long day care centre" }))).toBe(true);
    expect(isEceJob(raw({ title: "Cook", description: "Busy cafe in the CBD" }))).toBe(false);
    expect(isEceJob(raw({ title: "Primary School Teacher" }))).toBe(false);
    expect(isEceJob(raw({ title: "Diabetes Educator" }))).toBe(false);
  });

  it("assigns a role level", () => {
    expect(roleLevel("Early Childhood Teacher (ECT)")).toBe("Early Childhood Teacher");
    expect(roleLevel("Room Leader – Toddlers")).toBe("Room / Educational Leader");
    expect(roleLevel("Centre Director")).toBe("Centre Director");
    expect(roleLevel("Before & After School Care Educator")).toBe("OSHC");
    expect(roleLevel("Cert III Educator")).toBe("Educator (Cert III)");
  });

  it("detects the state from suburbs and cities", () => {
    expect(detectState("Parramatta NSW")).toBe("NSW");
    expect(detectState("Geelong")).toBe("VIC");
    expect(detectState("Gold Coast")).toBe("QLD");
    expect(detectState("Somewhere")).toBeNull();
  });

  it("treats the same ad on two channels as one job", () => {
    const a = dedupeKey({ title: "Diploma Educator", employer: "Wattle Grove Early Learning Pty Ltd", location: "Parramatta NSW 2150" });
    const b = dedupeKey({ title: "diploma educator", employer: "Wattle Grove Early Learning", location: "Parramatta NSW 2150" });
    expect(a).toBe(b);
  });
});

describe("mergeJobs", () => {
  const now = new Date().toISOString();
  const empty = { jobs: [], runs: [], lastCollectedAt: null };

  it("adds new ECE jobs and skips duplicates and non-ECE jobs", () => {
    const { data, added, found } = mergeJobs(empty, [raw({}), raw({ source: "Jooble" }), raw({ title: "Barista" })], now);
    expect(found).toBe(2);
    expect(added).toHaveLength(1);
    expect(data.jobs[0].state).toBe("NSW");
  });

  it("prefers the provider's own listing over a job-board copy", () => {
    const first = mergeJobs(empty, [raw({})], now).data;
    const { data } = mergeJobs(first, [raw({ sourceKind: "provider", source: "Wattle careers", url: "https://wattle.example/job" })], now);
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].source).toBe("Wattle careers");
  });
});

describe("sources", () => {
  beforeEach(() => {
    process.env.ADZUNA_APP_ID = "id";
    process.env.ADZUNA_APP_KEY = "key";
    process.env.ADZUNA_GAP_MS = "0";
    PROVIDERS.forEach((p) => (p.feed = null));
  });
  afterEach(() => {
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
  });

  it("maps Adzuna results", async () => {
    const fetcher = fakeFetch({
      "https://api.adzuna.com/v1/api/jobs/au/search/1": {
        results: [
          {
            title: "<strong>Early Childhood</strong> Educator",
            description: "Join our team",
            redirect_url: "https://adzuna.example/1",
            created: "2026-09-24T00:00:00Z",
            company: { display_name: "Kookaburra Learning" },
            location: { display_name: "Belconnen, ACT" },
            salary_min: 30,
            salary_max: 34,
            contract_time: "full_time",
          },
        ],
      },
    });
    const jobs = await fetchAdzuna(fetcher);
    expect(jobs[0]).toMatchObject({ title: "Early Childhood Educator", employer: "Kookaburra Learning", salary: "$30/hr – $34/hr", employmentType: "full time" });
  });

  it("parses RSS feeds", () => {
    const items = parseRss(`<rss><channel><item><title><![CDATA[Room Leader]]></title><link>https://x.example/1</link><description>&lt;p&gt;Toddler room&lt;/p&gt;</description><pubDate>Wed, 24 Sep 2026 08:00:00 GMT</pubDate></item></channel></rss>`);
    expect(items).toEqual([{ title: "Room Leader", link: "https://x.example/1", description: "Toddler room", pubDate: "Wed, 24 Sep 2026 08:00:00 GMT", location: "" }]);
  });

  it("finds JobPosting JSON-LD, including inside @graph", () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":"JobPosting","title":"ECT","jobLocation":{"address":{"addressLocality":"Brunswick","addressRegion":"VIC"}}}]}</script><script type="application/ld+json">{broken</script>`;
    expect(extractJobPostings(html).map((j) => j.title)).toEqual(["ECT"]);
  });

  it("follows job links from a careers page to read JSON-LD", async () => {
    const provider: Provider = { name: "Wattle Grove", website: "https://wattle.example", feed: { type: "jsonld", url: "https://wattle.example/careers" } };
    const fetcher = fakeFetch({
      "https://wattle.example/careers": `<a href="/careers/diploma-educator-parramatta">Diploma Educator</a><a href="/about">About</a>`,
      "https://wattle.example/careers/diploma-educator-parramatta": `<script type="application/ld+json">{"@type":"JobPosting","title":"Diploma Educator","datePosted":"2026-09-24","employmentType":"FULL_TIME","jobLocation":{"address":{"addressLocality":"Parramatta","addressRegion":"NSW"}},"baseSalary":{"value":{"minValue":32,"maxValue":35,"unitText":"HOUR"}}}</script>`,
    });
    const jobs = await fetchProvider(provider, fetcher);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ title: "Diploma Educator", location: "Parramatta, NSW", salary: "$32 – $35/hr", employmentType: "full time", url: "https://wattle.example/careers/diploma-educator-parramatta" });
  });

  it("reads Workable accounts", async () => {
    const provider: Provider = { name: "Banksia Kids", website: "https://banksia.example", feed: { type: "workable", account: "banksia" } };
    const fetcher = fakeFetch({
      "https://apply.workable.com/api/v1/widget/accounts/banksia": { jobs: [{ title: "Early Childhood Teacher", city: "Brunswick", state: "Victoria", url: "https://apply.workable.com/banksia/j/1" }] },
    });
    const jobs = await fetchProvider(provider, fetcher);
    expect(jobs[0]).toMatchObject({ title: "Early Childhood Teacher", location: "Brunswick, Victoria", sourceKind: "provider" });
  });
});

describe("provider websites", () => {
  it("finds the careers page and reads JobPosting data on each job page", async () => {
    const posting = (title: string, suburb: string) =>
      `<script type="application/ld+json">{"@type":"JobPosting","title":"${title}","description":"Join our team","jobLocation":{"address":{"addressLocality":"${suburb}","addressRegion":"QLD"}}}</script>`;
    const fetcher = fakeFetch({
      "https://big.example/robots.txt": "User-agent: *\nDisallow: /admin",
      "https://big.example/": `<a href="/about">About</a><a href="/careers">Careers</a>`,
      "https://big.example/careers": `<h1>Careers: join our team</h1><a href="/careers/jobs/diploma-educator-toowong">Diploma Educator</a><a href="/careers/jobs/cook-ipswich">Cook</a><a href="/careers/jobs/area-manager">Area Manager</a>`,
      "https://big.example/careers/jobs/diploma-educator-toowong": posting("Diploma Educator", "Toowong"),
      "https://big.example/careers/jobs/cook-ipswich": posting("Childcare Cook", "Ipswich"),
      "https://big.example/careers/jobs/area-manager": posting("Regional Finance Manager", "Brisbane"),
    });
    const jobs = await fetchProvider({ name: "Big Provider", website: "https://big.example/", feed: { type: "auto" } }, fetcher);
    expect(jobs.map((j) => [j.title, j.location, j.employer, j.sourceKind])).toEqual([
      ["Diploma Educator", "Toowong, QLD", "Big Provider", "provider"],
      ["Childcare Cook", "Ipswich, QLD", "Big Provider", "provider"],
    ]);
  });

  it("reports why a provider site gave no jobs", async () => {
    const fetcher = fakeFetch({ "https://quiet.example/": `<a href="/about">About</a>` });
    await expect(fetchProvider({ name: "Quiet", website: "https://quiet.example/", feed: { type: "auto" } }, fetcher)).rejects.toThrow(/no careers page/);
  });

  it("covers the large providers", () => {
    const names = PROVIDERS.map((p) => p.name).join(" ");
    for (const n of ["Goodstart", "G8", "Affinity", "Guardian", "Only About Children", "Busy Bees", "Nido", "C&K", "Explorers", "Where We Grow", "Aspire", "Green Leaves", "YMCA", "Little Zak", "Storyhouse", "Oz Education", "Inspire", "Montessori Academy", "Kool Beanz"]) expect(names).toContain(n);
  });
});

describe("collectAll", () => {
  beforeEach(() => {
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "feed-"));
    process.env.ADZUNA_APP_ID = "id";
    process.env.ADZUNA_APP_KEY = "key";
    process.env.ADZUNA_GAP_MS = "0";
    PROVIDERS.forEach((p) => (p.feed = null));
  });
  afterEach(() => {
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
    PROVIDERS.forEach((p) => (p.feed = null));
  });

  it("stores jobs and records a failing source without stopping the run", async () => {
    PROVIDERS[0].feed = { type: "rss", url: "https://broken.example/feed" };
    const fetcher = fakeFetch({
      "https://api.adzuna.com/": {
        results: [{ title: "Room Leader", description: "", redirect_url: "https://a.example/1", created: new Date().toISOString(), company: { display_name: "Seaside" }, location: { display_name: "Perth, WA" } }],
      },
    });
    const { runs, total } = await collectAll(fetcher);
    expect(total).toBe(1);
    expect(runs.find((r) => r.source === "Adzuna")).toMatchObject({ ok: true, added: 1 });
    expect(runs.find((r) => r.source.endsWith("careers"))).toMatchObject({ ok: false });

    const stored = await loadFeed();
    expect(stored.jobs[0]).toMatchObject({ title: "Room Leader", state: "WA", roleLevel: "Room / Educational Leader" });
    expect(stored.lastCollectedAt).not.toBeNull();

    // A second run the next morning doesn't duplicate the job.
    const again = await collectAll(fetcher);
    expect(again.total).toBe(1);
  });
});

describe("rate limits", () => {
  it("blocks a visitor after the hourly limit", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    process.env.RATE_LIMIT_FEEDBACK = "2";
    const req = () => new Request("http://x/api", { headers: { "x-forwarded-for": "203.0.113.9" } });
    expect(await rateLimit(req(), "feedback")).toBeNull();
    expect(await rateLimit(req(), "feedback")).toBeNull();
    const blocked = await rateLimit(req(), "feedback");
    expect(blocked?.status).toBe(429);
    expect(await blocked?.json()).toMatchObject({ error: expect.stringContaining("hourly limit") });
    delete process.env.RATE_LIMIT_FEEDBACK;
  });
});

describe("applying on the original site", () => {
  it("labels where the Apply button goes and tidies tracked links", async () => {
    const { applyTarget, canonicalJobUrl } = await import("@/lib/feed/apply");
    expect(applyTarget({ url: "https://www.seek.com.au/job/81234567", sourceKind: "email-alert", employer: "Wattle" })).toEqual({ site: "SEEK", ownSite: false });
    expect(applyTarget({ url: "https://careers.goodstart.org.au/job/123", sourceKind: "provider", employer: "Goodstart Early Learning" })).toEqual({ site: "Goodstart Early Learning", ownSite: true });
    expect(applyTarget({ url: "https://www.adzuna.com.au/land/ad/1", sourceKind: "job-board", employer: "X" })).toEqual({ site: null, ownSite: false });
    expect(canonicalJobUrl("https://www.seek.com.au/job/81234567?type=standard&ref=alert&utm_source=email")).toBe("https://www.seek.com.au/job/81234567");
    expect(canonicalJobUrl("https://au.indeed.com/rc/clk?jk=abc123&from=ja")).toBe("https://au.indeed.com/viewjob?jk=abc123");
  });

  it("keeps each job's link when reading an HTML alert email", async () => {
    const { extractJobs } = await import("@/lib/feed/sources/extract");
    const html = `<table><tr><td><a href="https://www.seek.com.au/job/81234567?ref=alert&amp;utm=1">Diploma Educator</a><br>Wattle Grove, Parramatta NSW</td></tr></table>`;
    const [job] = await extractJobs(html, { sourceKind: "email-alert", source: "SEEK alert" });
    expect(job.url).toBe("https://www.seek.com.au/job/81234567");
  });
});
