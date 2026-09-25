import { clean, isEceJob } from "../feed/classify";
import { extractJobs } from "../feed/sources/extract";
import { extractJobPostings, fetchProvider, type ProviderFeed } from "../feed/sources/providers";
import type { RawJob } from "../feed/types";
import type { SiteScan, SiteStatus } from "./types";

export const UA = "HireMeECE-CentreScanner/1.0 (+https://hiremeece.au)";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;

const CAREERS_LINK = /career|\bjobs?\b|employment|work[- ](with|for)[- ]us|join[- ](our|the)[- ]team|vacanc|positions|opportunit|we'?re[- ]hiring|recruit/i;
const COMMON_PATHS = ["/careers", "/jobs", "/work-with-us", "/join-our-team", "/employment", "/vacancies"];
const NO_OPENINGS =
  /no (current )?(vacancies|positions|openings|jobs)|not currently (recruiting|hiring)|no positions (are )?(currently )?available|there are currently no|check back (soon|later)/i;
const HIRING_WORDS = /we'?re hiring|now hiring|current (vacancies|opportunities|openings)|open positions|join our team|apply now|position available|vacancy/i;
const ROLE_WORDS = /educator|teacher|\bect\b|room leader|educational leader|centre (director|manager)|cook|chef|oshc|diploma|cert(ificate)? ?iii/i;

/** Recruitment systems centres commonly link to. Known ones with public feeds are read directly. */
const PORTALS: { name: string; host: RegExp; feed?: (url: URL) => ProviderFeed | null }[] = [
  { name: "Workable", host: /(^|\.)workable\.com$/, feed: (u) => (u.pathname.split("/")[1] ? { type: "workable", account: u.pathname.split("/")[1] } : null) },
  { name: "Lever", host: /^jobs\.lever\.co$/, feed: (u) => (u.pathname.split("/")[1] ? { type: "lever", company: u.pathname.split("/")[1] } : null) },
  { name: "Greenhouse", host: /greenhouse\.io$/, feed: (u) => (u.pathname.split("/")[1] ? { type: "greenhouse", board: u.pathname.split("/")[1] } : null) },
  { name: "SmartRecruiters", host: /smartrecruiters\.com$/, feed: (u) => (u.pathname.split("/")[1] ? { type: "smartrecruiters", companyId: u.pathname.split("/")[1] } : null) },
  { name: "PageUp", host: /pageuppeople\.com$/ },
  { name: "ELMO", host: /elmotalent\.com\.au$/ },
  { name: "Employment Hero", host: /employmenthero\.com$/ },
  { name: "JobAdder", host: /jobadder\.com$/ },
  { name: "Scout Talent", host: /(scouttalent|applynow)\.(net|com)(\.au)?$/ },
  { name: "BambooHR", host: /bamboohr\.com$/ },
  { name: "Applied", host: /beapplied\.com$/ },
];

async function get(url: string, fetcher: typeof fetch): Promise<{ url: string; html: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetcher(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "text/html";
    if (!/html|text|xml/.test(type)) return null;
    const html = (await res.text()).slice(0, MAX_BYTES);
    return { url: res.url || url, html };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Minimal robots.txt check for our user agent (and "*"). */
export function robotsAllows(robots: string, path: string): boolean {
  let applies = false;
  let matchedSpecific = false;
  const rules: { allow: boolean; path: string }[] = [];
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, value] = m;
    if (key.toLowerCase() === "user-agent") {
      const ua = value.toLowerCase();
      const specific = ua.includes("hiremeece");
      if (specific && !matchedSpecific) {
        rules.length = 0;
        matchedSpecific = true;
      }
      applies = specific || (ua === "*" && !matchedSpecific);
    } else if (applies && value) {
      rules.push({ allow: key.toLowerCase() === "allow", path: value });
    }
  }
  const hits = rules.filter((r) => path.startsWith(r.path.replace(/\*.*$/, "")));
  if (!hits.length) return true;
  const longest = hits.sort((a, b) => b.path.length - a.path.length)[0];
  return longest.allow;
}

function links(html: string, base: string) {
  const out: { href: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      out.push({ href: new URL(m[1], base).toString(), text: clean(m[2]).slice(0, 120) });
    } catch {
      // Ignore malformed links.
    }
  }
  for (const m of html.matchAll(/<iframe\b[^>]*src=["']([^"']+)["']/gi)) {
    try {
      out.push({ href: new URL(m[1], base).toString(), text: "" });
    } catch {
      // Ignore malformed frames.
    }
  }
  return out;
}

const sameSite = (a: string, b: string) => new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, "");

function findPortal(all: { href: string }[]) {
  for (const { href } of all) {
    const u = new URL(href);
    const portal = PORTALS.find((p) => p.host.test(u.hostname));
    if (portal) return { portal, url: u };
  }
  return null;
}

export interface ScanInput {
  domain: string;
  homepage: string;
  name: string;
  states: string[];
  serviceCount: number;
  /** Used as the job location when the site belongs to a single service. */
  location: string;
}

/** Checks one centre or provider website for open positions. Never throws. */
export async function scanSite(site: ScanInput, fetcher: typeof fetch = fetch): Promise<{ scan: SiteScan; jobs: RawJob[] }> {
  const now = new Date().toISOString();
  const result = (status: SiteStatus, extra: Partial<SiteScan> = {}, jobs: RawJob[] = []) => ({
    scan: { domain: site.domain, homepage: site.homepage, name: site.name, states: site.states, serviceCount: site.serviceCount, status, careersUrl: null, portal: null, jobTitles: jobs.map((j) => j.title).slice(0, 20), checkedAt: now, ...extra },
    jobs,
  });

  try {
    const robots = await get(new URL("/robots.txt", site.homepage).toString(), fetcher);
    const allowed = (url: string) => !robots || !sameSite(url, site.homepage) || robotsAllows(robots.html, new URL(url).pathname);
    if (!allowed(site.homepage)) return result("blocked");

    const home = await get(site.homepage, fetcher);
    if (!home) return result("unreachable");

    // Candidate careers pages: links that look like careers, then common paths.
    const homeLinks = links(home.html, home.url);
    const candidates = Array.from(
      new Set([
        ...homeLinks.filter((l) => CAREERS_LINK.test(l.text) || CAREERS_LINK.test(new URL(l.href).pathname)).map((l) => l.href),
        ...COMMON_PATHS.map((p) => new URL(p, home.url).toString()),
      ]),
    ).filter(allowed);

    // A careers link straight to a recruitment system.
    const direct = findPortal(homeLinks.filter((l) => CAREERS_LINK.test(l.text) || CAREERS_LINK.test(l.href)));
    if (direct) return await fromPortal(direct, direct.url.toString());

    let page: { url: string; html: string } | null = null;
    for (const url of candidates.slice(0, 5)) {
      if (!sameSite(url, home.url)) {
        const portal = findPortal([{ href: url }]);
        if (portal) return await fromPortal(portal, url);
        continue;
      }
      const p = await get(url, fetcher);
      // Many sites answer unknown paths with their homepage, so the page itself must be about careers.
      if (p && p.url !== home.url && p.html !== home.html && CAREERS_LINK.test(clean(p.html).slice(0, 3000))) {
        page = p;
        break;
      }
    }
    if (!page) return result("no-careers-page");

    const pageLinks = links(page.html, page.url);
    const text = clean(page.html);

    // 1. Structured job data.
    const postings = extractJobPostings(page.html);
    if (postings.length) {
      const jobs = postings.map((j) => toJob(clean(j.title ?? ""), j.url || page!.url, clean(j.description ?? "")));
      return result(jobs.length ? "hiring" : "no-openings", { careersUrl: page.url }, jobs);
    }

    // 2. Roles advertised on SEEK and linked from the careers page.
    const seekJobs = pageLinks.filter((l) => /(^|\.)seek\.com\.au$/.test(new URL(l.href).hostname) && /\/job\/\d+/.test(l.href) && l.text.length > 3);
    if (seekJobs.length) {
      const jobs = Array.from(new Map(seekJobs.map((l) => [l.href, l])).values()).map((l) => toJob(l.text, l.href));
      return result("hiring", { careersUrl: page.url, portal: "SEEK" }, jobs);
    }

    // 3. An embedded or linked recruitment system.
    const portal = findPortal(pageLinks);
    if (portal) return await fromPortal(portal, page.url);

    // 4. Plain text.
    if (NO_OPENINGS.test(text) && !HIRING_WORDS.test(text.replace(NO_OPENINGS, ""))) return result("no-openings", { careersUrl: page.url });
    if (ROLE_WORDS.test(text) && HIRING_WORDS.test(text)) {
      const jobs = (await extractJobs(text.slice(0, 20_000), { sourceKind: "provider", source: `${site.name} website` }))
        .map((j) => ({ ...j, employer: j.employer || site.name, location: j.location || site.location, url: j.url || page!.url }))
        .filter(isEceJob);
      if (jobs.length) return result("hiring", { careersUrl: page.url }, jobs);
    }
    return result("no-openings", { careersUrl: page.url });
  } catch (err) {
    return result("unreachable", { error: err instanceof Error ? err.message : String(err) });
  }

  function toJob(title: string, url: string, description = ""): RawJob {
    return {
      title,
      employer: site.name,
      location: site.location,
      salary: "",
      employmentType: "",
      url,
      description,
      sourceKind: "provider",
      source: `${site.name} website`,
      postedAt: now,
    };
  }

  async function fromPortal(found: { portal: (typeof PORTALS)[number]; url: URL }, careersUrl: string) {
    const feed = found.portal.feed?.(found.url);
    if (feed) {
      try {
        const jobs = (await fetchProvider({ name: site.name, website: site.homepage, feed }, fetcher))
          .map((j) => ({ ...j, source: `${site.name} website`, location: j.location || site.location }))
          .filter(isEceJob);
        return result(jobs.length ? "hiring" : "no-openings", { careersUrl, portal: found.portal.name }, jobs);
      } catch {
        // Fall through: link to the portal.
      }
    }
    return result("portal", { careersUrl: found.url.toString(), portal: found.portal.name });
  }
}
