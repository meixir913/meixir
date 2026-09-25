import { clean } from "../classify";
import type { RawJob } from "../types";

/**
 * How to read a provider's careers site. Most large providers post jobs through an applicant
 * tracking system (ATS) with a public job feed, or mark up each job with schema.org JobPosting
 * data (which Google for Jobs requires). Pick whichever the provider's site offers.
 */
export type ProviderFeed =
  | { type: "rss"; url: string }
  /** A careers search page. Reads JobPosting JSON-LD on the page, then on job pages it links to. */
  | { type: "jsonld"; url: string; jobLinkPattern?: string; maxJobPages?: number }
  | { type: "workable"; account: string }
  | { type: "smartrecruiters"; companyId: string }
  | { type: "lever"; company: string }
  | { type: "greenhouse"; board: string };

export interface Provider {
  name: string;
  website: string;
  /** null until someone confirms which feed the provider's careers site exposes. */
  feed: ProviderFeed | null;
}

/**
 * Large Australian early learning providers. To start collecting from one, open its careers page,
 * find which of the feed types above it uses, and fill in `feed`. See README → "Job feed".
 */
export const PROVIDERS: Provider[] = [
  { name: "Goodstart Early Learning", website: "https://www.goodstart.org.au", feed: null },
  { name: "G8 Education", website: "https://www.g8education.edu.au", feed: null },
  { name: "Affinity Education", website: "https://www.affinityeducation.com.au", feed: null },
  { name: "Guardian Childcare & Education", website: "https://www.guardian.edu.au", feed: null },
  { name: "Only About Children", website: "https://www.oac.edu.au", feed: null },
  { name: "Busy Bees Australia", website: "https://www.busybees.edu.au", feed: null },
  { name: "Nido Early School", website: "https://www.nido.edu.au", feed: null },
  { name: "Young Academics", website: "https://www.youngacademics.com.au", feed: null },
  { name: "KU Children's Services", website: "https://www.ku.com.au", feed: null },
  { name: "C&K", website: "https://www.candk.asn.au", feed: null },
  { name: "Camp Australia (OSHC)", website: "https://www.campaustralia.com.au", feed: null },
];

const UA = "HireMeECE-JobFeed/1.0 (+https://hiremeece.au)";

async function getText(url: string, fetcher: typeof fetch) {
  const res = await fetcher(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xml,application/json" } });
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  return res.text();
}

async function getJson<T>(url: string, fetcher: typeof fetch): Promise<T> {
  return JSON.parse(await getText(url, fetcher)) as T;
}

const base = (p: Provider, source: string) => ({
  employer: p.name,
  salary: "",
  employmentType: "",
  sourceKind: "provider" as const,
  source,
});

export async function fetchProvider(p: Provider, fetcher: typeof fetch = fetch): Promise<RawJob[]> {
  const feed = p.feed;
  if (!feed) return [];
  const label = `${p.name} careers`;

  switch (feed.type) {
    case "rss":
      return parseRss(await getText(feed.url, fetcher)).map((i) => ({
        ...base(p, label),
        title: i.title,
        location: i.location,
        url: i.link,
        description: i.description,
        postedAt: i.pubDate,
      }));

    case "jsonld":
      return fetchJsonLd(p, feed, fetcher, label);

    case "workable": {
      type W = { jobs: { title: string; city?: string; state?: string; url: string; published_on?: string; employment_type?: string; description?: string }[] };
      const data = await getJson<W>(`https://apply.workable.com/api/v1/widget/accounts/${feed.account}?details=true`, fetcher);
      return data.jobs.map((j) => ({
        ...base(p, label),
        title: j.title,
        location: [j.city, j.state].filter(Boolean).join(", "),
        employmentType: j.employment_type ?? "",
        url: j.url,
        description: clean(j.description ?? ""),
        postedAt: j.published_on ?? "",
      }));
    }

    case "smartrecruiters": {
      type S = { content: { id: string; name: string; releasedDate?: string; location?: { city?: string; region?: string }; typeOfEmployment?: { label?: string } }[] };
      const data = await getJson<S>(`https://api.smartrecruiters.com/v1/companies/${feed.companyId}/postings?limit=100&country=au`, fetcher);
      return data.content.map((j) => ({
        ...base(p, label),
        title: j.name,
        location: [j.location?.city, j.location?.region].filter(Boolean).join(", "),
        employmentType: j.typeOfEmployment?.label ?? "",
        url: `https://jobs.smartrecruiters.com/${feed.companyId}/${j.id}`,
        description: "",
        postedAt: j.releasedDate ?? "",
      }));
    }

    case "lever": {
      type L = { text: string; hostedUrl: string; createdAt?: number; descriptionPlain?: string; categories?: { location?: string; commitment?: string } }[];
      const data = await getJson<L>(`https://api.lever.co/v0/postings/${feed.company}?mode=json`, fetcher);
      return data.map((j) => ({
        ...base(p, label),
        title: j.text,
        location: j.categories?.location ?? "",
        employmentType: j.categories?.commitment ?? "",
        url: j.hostedUrl,
        description: j.descriptionPlain ?? "",
        postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : "",
      }));
    }

    case "greenhouse": {
      type G = { jobs: { title: string; absolute_url: string; updated_at?: string; location?: { name?: string }; content?: string }[] };
      const data = await getJson<G>(`https://boards-api.greenhouse.io/v1/boards/${feed.board}/jobs?content=true`, fetcher);
      return data.jobs.map((j) => ({
        ...base(p, label),
        title: j.title,
        location: j.location?.name ?? "",
        url: j.absolute_url,
        description: clean(j.content ?? ""),
        postedAt: j.updated_at ?? "",
      }));
    }
  }
}

// ---------------------------------------------------------------- RSS

export function parseRss(xml: string) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const tag = (block: string, name: string) => {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
    return m ? clean(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "")) : "";
  };
  return items.map((block) => {
    const atomLink = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
    return {
      title: tag(block, "title"),
      link: tag(block, "link") || atomLink,
      description: tag(block, "description") || tag(block, "summary") || tag(block, "content"),
      pubDate: tag(block, "pubDate") || tag(block, "published") || tag(block, "updated"),
      location: tag(block, "job:location") || tag(block, "location"),
    };
  });
}

// ---------------------------------------------------------------- schema.org JobPosting

interface JobPosting {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  datePosted?: string;
  employmentType?: string | string[];
  url?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: JobPlace | JobPlace[];
  baseSalary?: { currency?: string; value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string } };
}
interface JobPlace {
  address?: { addressLocality?: string; addressRegion?: string } | string;
}

/** Finds every JobPosting in a page's JSON-LD blocks, including ones nested in @graph or ItemList. */
export function extractJobPostings(html: string): JobPosting[] {
  const found: JobPosting[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) found.push(obj as JobPosting);
    for (const key of ["@graph", "itemListElement", "item", "mainEntity"]) visit(obj[key]);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {
      // Malformed JSON-LD is common; skip that block.
    }
  }
  return found;
}

function postingToRaw(j: JobPosting, pageUrl: string, p: Provider, label: string): RawJob {
  const places = Array.isArray(j.jobLocation) ? j.jobLocation : j.jobLocation ? [j.jobLocation] : [];
  const addr = places[0]?.address;
  const location = typeof addr === "string" ? addr : [addr?.addressLocality, addr?.addressRegion].filter(Boolean).join(", ");
  const v = j.baseSalary?.value;
  const unit = v?.unitText?.toLowerCase() === "hour" ? "/hr" : v?.unitText?.toLowerCase() === "year" ? "/yr" : "";
  const salary = v ? [v.minValue ?? v.value, v.maxValue].filter(Boolean).map((n) => `$${n}`).join(" – ") + unit : "";
  return {
    ...base(p, label),
    employer: j.hiringOrganization?.name || p.name,
    title: clean(j.title ?? ""),
    location,
    salary,
    employmentType: [j.employmentType].flat().filter(Boolean).join(", ").replace(/_/g, " ").toLowerCase(),
    url: j.url || pageUrl,
    description: clean(j.description ?? ""),
    postedAt: j.datePosted ?? "",
  };
}

async function fetchJsonLd(p: Provider, feed: Extract<ProviderFeed, { type: "jsonld" }>, fetcher: typeof fetch, label: string) {
  const html = await getText(feed.url, fetcher);
  const onPage = extractJobPostings(html);
  if (onPage.length) return onPage.map((j) => postingToRaw(j, feed.url, p, label));

  // Listing pages often only link to jobs; visit each job page (politely capped).
  const pattern = new RegExp(feed.jobLinkPattern ?? "/(jobs?|careers?|vacanc(y|ies)|positions?)/[^\"'#?]+", "i");
  const links = Array.from(new Set(Array.from(html.matchAll(/href=["']([^"']+)["']/gi), (m) => m[1]).filter((h) => pattern.test(h))))
    .map((h) => new URL(h, feed.url).toString())
    .slice(0, feed.maxJobPages ?? 40);
  const jobs: RawJob[] = [];
  for (const link of links) {
    try {
      const page = await getText(link, fetcher);
      for (const j of extractJobPostings(page)) jobs.push(postingToRaw(j, link, p, label));
    } catch {
      // One broken job page shouldn't stop the rest.
    }
  }
  return jobs;
}
