import { createHash } from "node:crypto";
import type { AuState, FeedJob, RawJob, RoleLevel } from "./types";

const ECE_TITLE =
  /early childhood|early learning|child ?care|educator|kinder|kindy|preschool|pre-school|\bect\b|\boshc\b|outside school hours|vacation care|room leader|educational leader|nominated supervisor|centre (director|manager)|cert(ificate)? ?(iii|3)|family day care|education and care|nanny/i;
// Jobs that mention "educator" or "teacher" but are outside early childhood.
const NOT_ECE = /\b(primary|secondary|high school|university|lecturer|driving|fitness|swim(ming)?|diabetes|clinical|nurse educator|trainer and assessor)\b/i;

/** Employers whose name shows they run early learning services (e.g. "Nido Early School", "C&K", "Busy Bees"). */
const ECE_EMPLOYER =
  /early (learning|school|education|years)|child ?care|children'?s (centre|services)|kindergarten|kindy|preschool|montessori|\boshc\b|\bc&k\b|creche|busy bees|goodstart|g8 education|guardian childcare|only about children|affinity education|nido|explorers|story ?house|little zak|kool beanz|green leaves|camp australia|teamkids|sherpa kids|ymca|journey early|\bku\b/i;
/** Jobs at those employers that are still not care roles. */
const OFFICE_ROLE = /\b(accountant|finance|payroll|recruit(er|ment)|marketing|it support|developer|analyst|legal|procurement|facilities|maintenance)\b/i;
const OSHC = /\boshc\b|outside school hours|vacation care|before (and|&) after school/i;

/** True when a listing is an early childhood role worth keeping in the feed. */
export function isEceJob(job: Pick<RawJob, "title" | "description"> & { employer?: string }): boolean {
  // OSHC roles are based at primary schools, so "primary" doesn't rule them out.
  if (OSHC.test(job.title) || /early childhood|pre-?primary/i.test(job.title)) return true;
  if (NOT_ECE.test(job.title)) return false;
  if (ECE_TITLE.test(job.title)) return true;
  // Generic titles ("Teacher", "Assistant Director", "Multiple Roles") at an early learning employer.
  if (job.employer && ECE_EMPLOYER.test(job.employer) && !OFFICE_ROLE.test(job.title)) return true;
  // Titles like "Teacher" or "Cook" are ECE only when the ad says so.
  return /\b(teacher|cook|chef|leader|director)\b/i.test(job.title) && /early childhood|child ?care|early learning|kindergarten|long day care/i.test(job.description);
}

export function roleLevel(title: string): RoleLevel {
  if (OSHC.test(title)) return "OSHC";
  if (/centre (director|manager)|\bdirector\b|nominated supervisor|area manager/i.test(title)) return "Centre Director";
  if (/room leader|educational leader|2ic|assistant (centre )?(director|manager)|lead educator/i.test(title)) return "Room / Educational Leader";
  if (/teacher|\bect\b|bachelor/i.test(title)) return "Early Childhood Teacher";
  if (/\bcook\b|\bchef\b/i.test(title)) return "Cook";
  if (/diploma/i.test(title)) return "Diploma Educator";
  if (/cert(ificate)? ?(iii|3)|trainee/i.test(title)) return "Educator (Cert III)";
  return "Educator";
}

const STATE_WORDS: [AuState, RegExp][] = [
  ["NSW", /\bnsw\b|new south wales|sydney|parramatta|newcastle|wollongong|central coast|penrith|blacktown|liverpool|hills district|north shore/i],
  ["VIC", /\bvic\b|victoria|melbourne|geelong|ballarat|bendigo|dandenong|frankston|werribee/i],
  ["QLD", /\bqld\b|queensland|brisbane|gold coast|sunshine coast|townsville|cairns|toowoomba|ipswich|logan/i],
  ["WA", /\bwa\b|western australia|perth|fremantle|joondalup|mandurah|bunbury/i],
  ["SA", /\bsa\b|south australia|adelaide/i],
  ["TAS", /\btas\b|tasmania|hobart|launceston/i],
  ["ACT", /\bact\b|australian capital territory|canberra/i],
  ["NT", /\bnt\b|northern territory|darwin|alice springs/i],
];

export function detectState(location: string): AuState | null {
  for (const [state, re] of STATE_WORDS) if (re.test(location)) return state;
  return null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(pty|ltd|limited|inc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Same job posted on several channels (SEEK alert, Adzuna, the provider's site) collapses to one id.
 * Keyed on title, employer and the first part of the location.
 */
export function dedupeKey(job: Pick<RawJob, "title" | "employer" | "location">): string {
  const place = norm(job.location.split(",")[0] ?? "");
  return createHash("sha1").update(`${norm(job.title)}|${norm(job.employer)}|${place}`).digest("hex").slice(0, 16);
}

export function toFeedJob(raw: RawJob, collectedAt: string): FeedJob {
  return {
    ...raw,
    id: dedupeKey(raw),
    title: raw.title.trim(),
    description: clean(raw.description).slice(0, 600),
    state: raw.state ?? detectState(`${raw.location} ${raw.description.slice(0, 200)}`),
    roleLevel: roleLevel(raw.title),
    postedAt: raw.postedAt || collectedAt,
    collectedAt,
  };
}

const stripTags = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

/** Strip HTML tags (including entity-encoded ones, common in RSS) and collapse whitespace. */
export function clean(html: string): string {
  const decoded = stripTags(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
  return stripTags(decoded)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function formatSalary(min?: number | null, max?: number | null): string {
  if (!min && !max) return "";
  const fmt = (n: number) => (n < 500 ? `$${n.toFixed(2).replace(/\.00$/, "")}/hr` : `$${Math.round(n / 1000)}k`);
  if (min && max && Math.round(min) !== Math.round(max)) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((min || max)!);
}
