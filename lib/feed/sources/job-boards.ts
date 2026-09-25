import { clean, formatSalary } from "../classify";
import type { RawJob } from "../types";

// Official job-search APIs with Australian coverage. They aggregate listings from many boards
// (including ads that also appear on SEEK and Indeed) and allow automated access with a free key.
// SEEK and Indeed themselves have no public search API and their terms forbid scraping, so their
// ads also come in through job alert emails (see api/ingest/email).

export const BOARD_QUERIES = [
  "early childhood educator",
  "early childhood teacher",
  "childcare educator",
  "child care worker",
  "diploma educator childcare",
  "certificate III childcare",
  "room leader childcare",
  "educational leader early learning",
  "childcare centre director",
  "assistant centre director childcare",
  "childcare cook",
  "kindergarten teacher",
  "preschool teacher",
  "OSHC educator",
  "family day care educator",
];

/** Large providers, searched by name so their ads are found on job boards even when their own site can't be read. */
export const EMPLOYER_QUERIES = [
  "Goodstart Early Learning",
  "G8 Education",
  "Affinity Education",
  "Guardian Childcare",
  "Only About Children",
  "Busy Bees early learning",
  "Nido Early School",
  "C&K kindergarten",
  "Explorers Early Learning",
  "Where We Grow early learning",
  "Aspire Early Education",
  "Green Leaves Early Learning",
  "YMCA children's services",
  "Little Zak's Academy",
  "Storyhouse Early Learning",
  "Oz Education",
  "Inspire Early Learning Journey",
  "Montessori Academy",
  "Kool Beanz Childcare",
  "Young Academics",
  "KU Children's Services",
  "Camp Australia",
];

/** Role searches look at several result pages; employer searches at one. */
const searches = () => [...BOARD_QUERIES.flatMap((q) => [1, 2, 3].map((page) => ({ q, page }))), ...EMPLOYER_QUERIES.map((q) => ({ q, page: 1 }))];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const UA = "HireMeECE-JobFeed/1.0 (+https://hiremeece.au)";

// ---------------------------------------------------------------- Adzuna
// https://developer.adzuna.com — set ADZUNA_APP_ID and ADZUNA_APP_KEY.

interface AdzunaResult {
  title: string;
  description: string;
  redirect_url: string;
  created: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
  contract_time?: string;
  contract_type?: string;
}

export const adzunaEnabled = () => Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);

export async function fetchAdzuna(fetcher: typeof fetch = fetch): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  const done = new Set<string>(); // queries with no further pages
  for (const { q, page } of searches()) {
    if (done.has(q)) continue;
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/au/search/${page}`);
    url.searchParams.set("app_id", process.env.ADZUNA_APP_ID!);
    url.searchParams.set("app_key", process.env.ADZUNA_APP_KEY!);
    url.searchParams.set("what", q);
    url.searchParams.set("max_days_old", "3");
    url.searchParams.set("results_per_page", "50");
    url.searchParams.set("sort_by", "date");
    const res = await fetcher(url, { headers: { Accept: "application/json", "User-Agent": UA } });
    if (res.status === 429) break; // daily or per-minute limit reached: keep what we have
    if (!res.ok) throw new Error(`Adzuna returned ${res.status}`);
    const data = (await res.json()) as { results?: AdzunaResult[] };
    const results = data.results ?? [];
    if (results.length < 50) done.add(q);
    for (const r of results) {
      jobs.push({
        title: clean(r.title),
        employer: r.company?.display_name ?? "",
        location: r.location?.display_name ?? "",
        salary: formatSalary(r.salary_min, r.salary_max),
        employmentType: [r.contract_time, r.contract_type].filter(Boolean).join(", ").replace(/_/g, " "),
        url: r.redirect_url,
        description: clean(r.description),
        sourceKind: "job-board",
        source: "Adzuna",
        postedAt: r.created,
      });
    }
    await pause(Number(process.env.ADZUNA_GAP_MS ?? 2_500)); // Adzuna allows about 25 requests a minute
  }
  return jobs;
}

// ---------------------------------------------------------------- Jooble
// https://jooble.org/api/about — set JOOBLE_API_KEY.

interface JoobleJob {
  title: string;
  location: string;
  snippet: string;
  salary: string;
  source: string;
  type: string;
  link: string;
  company: string;
  updated: string;
}

export const joobleEnabled = () => Boolean(process.env.JOOBLE_API_KEY);

export async function fetchJooble(fetcher: typeof fetch = fetch): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  const done = new Set<string>();
  for (const { q: keywords, page } of searches()) {
    if (done.has(keywords)) continue;
    const res = await fetcher(`https://jooble.org/api/${process.env.JOOBLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ keywords, location: "Australia", page: String(page), datecreatedfrom: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10) }),
    });
    if (res.status === 429) break;
    if (!res.ok) throw new Error(`Jooble returned ${res.status}`);
    const data = (await res.json()) as { jobs?: JoobleJob[] };
    if ((data.jobs ?? []).length < 20) done.add(keywords);
    for (const j of data.jobs ?? []) {
      jobs.push({
        title: clean(j.title),
        employer: j.company ?? "",
        location: j.location ?? "",
        salary: j.salary ?? "",
        employmentType: j.type ?? "",
        url: j.link,
        description: clean(j.snippet ?? ""),
        sourceKind: "job-board",
        source: j.source ? `Jooble · ${j.source}` : "Jooble",
        postedAt: j.updated,
      });
    }
  }
  return jobs;
}

// ---------------------------------------------------------------- Careerjet
// https://www.careerjet.com.au/partners/api — set CAREERJET_AFFID (free partner ID).

interface CareerjetJob {
  title: string;
  company: string;
  locations: string;
  salary: string;
  date: string;
  description: string;
  url: string;
  site: string;
}

export const careerjetEnabled = () => Boolean(process.env.CAREERJET_AFFID);

export async function fetchCareerjet(fetcher: typeof fetch = fetch): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  const done = new Set<string>();
  for (const { q, page } of searches()) {
    if (done.has(q)) continue;
    const url = new URL("http://public.api.careerjet.net/search");
    url.searchParams.set("locale_code", "en_AU");
    url.searchParams.set("keywords", q);
    url.searchParams.set("location", "Australia");
    url.searchParams.set("sort", "date");
    url.searchParams.set("pagesize", "99");
    url.searchParams.set("page", String(page));
    url.searchParams.set("affid", process.env.CAREERJET_AFFID!);
    // Careerjet asks for the end user's details; for a server-side collector these identify the server.
    url.searchParams.set("user_ip", "127.0.0.1");
    url.searchParams.set("user_agent", UA);
    const res = await fetcher(url, { headers: { Accept: "application/json", "User-Agent": UA } });
    if (!res.ok) throw new Error(`Careerjet returned ${res.status}`);
    const data = (await res.json()) as { type?: string; jobs?: CareerjetJob[] };
    if (data.type !== "JOBS" || (data.jobs ?? []).length < 99) done.add(q);
    if (data.type !== "JOBS") continue;
    for (const j of data.jobs ?? []) {
      jobs.push({
        title: clean(j.title),
        employer: j.company ?? "",
        location: j.locations ?? "",
        salary: j.salary ?? "",
        employmentType: "",
        url: j.url,
        description: clean(j.description ?? ""),
        sourceKind: "job-board",
        source: j.site ? `Careerjet · ${j.site}` : "Careerjet",
        postedAt: j.date ? new Date(j.date).toISOString() : "",
      });
    }
  }
  return jobs;
}
