import type { FeedJob } from "./types";

// Hire Me ECE shows the job; applying always happens on the site that posted it.

const SITES: [RegExp, string][] = [
  [/(^|\.)seek\.com\.au$/, "SEEK"],
  [/(^|\.)indeed\.com(\.au)?$/, "Indeed"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)ethicaljobs\.com\.au$/, "EthicalJobs"],
  [/(^|\.)jora\.com$/, "Jora"],
  [/(^|\.)facebook\.com$/, "Facebook"],
];
/** Aggregators whose links forward to the original ad. */
const FORWARDERS = /(^|\.)(adzuna\.com\.au|adzuna\.com|jooble\.org|careerjet\.com\.au|careerjet\.net)$/;

/** Where the Apply button sends people, e.g. { site: "SEEK" } or { site: "Goodstart Early Learning" }. */
export function applyTarget(job: Pick<FeedJob, "url" | "sourceKind" | "employer">): { site: string | null; ownSite: boolean } {
  let host = "";
  try {
    host = new URL(job.url).hostname.replace(/^www\./, "");
  } catch {
    return { site: null, ownSite: false };
  }
  const named = SITES.find(([re]) => re.test(host));
  if (named) return { site: named[1], ownSite: false };
  if (FORWARDERS.test(host)) return { site: null, ownSite: false };
  // A provider's or centre's own careers site (or its recruitment system).
  return { site: job.employer || null, ownSite: true };
}

/**
 * Tidies job links from alert emails: SEEK and Indeed links carry tracking parameters, so they're
 * reduced to the plain job page. Other links are kept as they are.
 */
export function canonicalJobUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const seekId = /(^|\.)seek\.com\.au$/.test(host) && (u.pathname.match(/\/job\/(\d+)/)?.[1] ?? u.searchParams.get("jobId"));
    if (seekId) return `https://www.seek.com.au/job/${seekId}`;
    const jk = /(^|\.)indeed\.com(\.au)?$/.test(host) && (u.searchParams.get("jk") ?? u.searchParams.get("vjk"));
    if (jk) return `https://au.indeed.com/viewjob?jk=${jk}`;
    return url;
  } catch {
    return url;
  }
}
