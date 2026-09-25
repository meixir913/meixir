import { clean, formatSalary } from "../classify";
import type { RawJob } from "../types";

// Official job-search APIs with Australian coverage. Both aggregate listings from many boards
// (including ads that also appear on SEEK and Indeed) and allow automated access with a free key.

export const BOARD_QUERIES = [
  "early childhood educator",
  "early childhood teacher",
  "childcare educator",
  "diploma educator childcare",
  "room leader childcare",
  "childcare centre director",
  "OSHC educator",
];

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
  for (const what of BOARD_QUERIES) {
    const url = new URL("https://api.adzuna.com/v1/api/jobs/au/search/1");
    url.searchParams.set("app_id", process.env.ADZUNA_APP_ID!);
    url.searchParams.set("app_key", process.env.ADZUNA_APP_KEY!);
    url.searchParams.set("what", what);
    url.searchParams.set("max_days_old", "3");
    url.searchParams.set("results_per_page", "50");
    url.searchParams.set("sort_by", "date");
    const res = await fetcher(url, { headers: { Accept: "application/json", "User-Agent": UA } });
    if (!res.ok) throw new Error(`Adzuna returned ${res.status}`);
    const data = (await res.json()) as { results?: AdzunaResult[] };
    for (const r of data.results ?? []) {
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
  for (const keywords of BOARD_QUERIES) {
    const res = await fetcher(`https://jooble.org/api/${process.env.JOOBLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ keywords, location: "Australia", datecreatedfrom: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10) }),
    });
    if (!res.ok) throw new Error(`Jooble returned ${res.status}`);
    const data = (await res.json()) as { jobs?: JoobleJob[] };
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
