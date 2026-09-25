import { generateJson, isDemoMode } from "../../claude";
import { canonicalJobUrl } from "../apply";
import { clean } from "../classify";
import type { RawJob, SourceKind } from "../types";

// Turns unstructured text into jobs with Claude: a Facebook group post someone pasted,
// or a SEEK / Indeed job-alert email forwarded to the inbound address.

const SYSTEM = `You extract early childhood education job listings from Australian job-alert emails and social media posts. Return one entry per distinct job. Only include what the text states; use an empty string when a field is missing. Ignore ads, unsubscribe footers and non-job content. If the text contains no job listing, return an empty list.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["jobs"],
  properties: {
    jobs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "employer", "location", "salary", "employmentType", "url", "description"],
        properties: {
          title: { type: "string" },
          employer: { type: "string", description: "Centre or company name" },
          location: { type: "string", description: "Suburb and state, e.g. Parramatta NSW" },
          salary: { type: "string" },
          employmentType: { type: "string", description: "Full time, part time, casual, contract" },
          url: { type: "string", description: "The link to this job's own ad or application page, copied exactly (links appear in [square brackets] after their text). Not an unsubscribe, settings or search-results link." },
          description: { type: "string", description: "Short summary of the role and requirements, and how to apply" },
        },
      },
    },
  },
} as const;

type Extracted = Omit<RawJob, "sourceKind" | "source" | "postedAt">;

export async function extractJobs(text: string, opts: { sourceKind: SourceKind; source: string; postedAt?: string }): Promise<RawJob[]> {
  // HTML emails keep their links in href attributes, which cleaning would drop: write them out first.
  const withLinks = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => (/^https?:/i.test(href) ? `${label} [${href.replace(/&amp;/g, "&")}]` : label));
  const body = clean(withLinks).slice(0, 60_000);
  if (!body) return [];
  const jobs = isDemoMode() ? demoExtract(body) : (await generateJson<{ jobs: Extracted[] }>({ system: SYSTEM, prompt: `<text>\n${body}\n</text>`, schema: SCHEMA, effort: "low" })).jobs;
  const postedAt = opts.postedAt ?? new Date().toISOString();
  return jobs.filter((j) => j.title).map((j) => ({ ...j, url: canonicalJobUrl(j.url), sourceKind: opts.sourceKind, source: opts.source, postedAt }));
}

/** Rough single-job guess used in demo mode (no API key). */
function demoExtract(text: string): Extracted[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = lines.find((l) => !/^subject:/i.test(l) && /educator|teacher|\bect\b|leader|director|\boshc\b|childcare|child care/i.test(l)) ?? lines[0] ?? "";
  return [
    {
      title: title.slice(0, 100),
      employer: "",
      location: (text.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)? (NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/) ?? [""])[0],
      salary: (text.match(/\$\s?\d[\d.,]*(\s?[-–]\s?\$?\s?\d[\d.,]*)?(\s?(\/|per)\s?(hour|hr|year))?/i) ?? [""])[0],
      employmentType: (text.match(/full[- ]time|part[- ]time|casual|permanent|contract/i) ?? [""])[0],
      url: (text.match(/https?:\/\/[^\s\]]+/) ?? [""])[0],
      description: text.slice(0, 400),
    },
  ];
}
