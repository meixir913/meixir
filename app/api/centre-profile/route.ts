import { describeError, generateJson, isDemoMode } from "@/lib/claude";
import { findWebsite, finderConfigured } from "@/lib/centres/find-website";
import { loadLookups, loadServices } from "@/lib/centres/pipeline";
import { demoCentre } from "@/lib/demo";
import { clean } from "@/lib/feed/classify";
import { CENTRE_SCHEMA, CENTRE_SYSTEM } from "@/lib/letter-prompts";
import type { CentreDetails, CentreProfileResponse } from "@/lib/letter-types";
import { rateLimit } from "@/lib/rate-limit";
import { fetchPublicPage } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const maxDuration = 60;

// Works out a centre's curriculum, philosophy and programs automatically, from the best source available:
//   1. its website, when a URL is given, or found from the centre's name (centre scanner results or a search API);
//   2. otherwise the job ad text.
const USEFUL_PAGE = /about|philosoph|curricul|program|our (centre|service|approach)|approach|learning|kinder|educat|values|rooms/i;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(pty|ltd|the|centre|center|early|learning|childcare|child care|elc)\b/g, "").replace(/\s+/g, " ").trim();

/** Finds the centre's website from its name: first the centre scanner's results, then a search API. */
async function websiteFor(name: string, location: string): Promise<string | null> {
  const key = norm(name);
  if (!key) return null;
  const lookups = Object.values(await loadLookups().catch(() => ({})));
  const known = lookups.find((l) => l.url && norm(l.name) === key);
  if (known?.url) return known.url;
  if (!finderConfigured()) return null;
  const found = await findWebsite(`${name} ${location} childcare`.trim()).catch(() => null);
  return found?.url ?? null;
}

/** Suburb and state from the ACECQA register, when the name matches one service. */
async function registerDetails(name: string): Promise<Pick<CentreDetails, "suburb" | "state">> {
  const key = norm(name);
  if (!key) return { suburb: "", state: "" };
  const matches = Object.values(await loadServices().catch(() => ({}))).filter((s) => norm(s.name) === key);
  return matches.length === 1 ? { suburb: matches[0].suburb, state: matches[0].state } : { suburb: "", state: "" };
}

async function readWebsite(url: string) {
  const home = await fetchPublicPage(url);
  const host = new URL(home.url).hostname;
  const links = Array.from(home.html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((m) => {
      try {
        return { href: new URL(m[1], home.url).toString(), text: clean(m[2]) };
      } catch {
        return null;
      }
    })
    .filter((l): l is { href: string; text: string } => !!l && new URL(l.href).hostname === host && (USEFUL_PAGE.test(l.text) || USEFUL_PAGE.test(new URL(l.href).pathname)));
  const pages = [home];
  for (const link of Array.from(new Set(links.map((l) => l.href))).slice(0, 4)) {
    try {
      pages.push(await fetchPublicPage(link));
    } catch {
      // Skip pages that fail; the others are enough.
    }
  }
  return { url: home.url, pagesRead: pages.length, text: pages.map((p) => `--- ${p.url}\n${clean(p.html)}`).join("\n\n").slice(0, 60_000) };
}

async function summarise(text: string, kind: "website" | "job ad"): Promise<Omit<CentreDetails, "website">> {
  if (isDemoMode()) return demoCentre(text);
  const tag = kind === "website" ? "website" : "job_ad";
  return generateJson<Omit<CentreDetails, "website">>({ system: CENTRE_SYSTEM, prompt: `<${tag}>\n${text}\n</${tag}>`, schema: CENTRE_SCHEMA, effort: "low" });
}

export async function POST(req: Request) {
  const limited = await rateLimit(req, "centre-profile");
  if (limited) return limited;
  const { url, name = "", location = "", text = "" } = (await req.json()) as { url?: string; name?: string; location?: string; text?: string };
  if (!url?.trim() && !name.trim() && !text.trim()) return Response.json({ error: "Enter the centre's website or name." }, { status: 400 });

  try {
    const website = url?.trim() || (await websiteFor(name, location));
    let siteError = "";
    if (website) {
      try {
        const site = await readWebsite(website);
        const details = await summarise(site.text, "website");
        const reg = await registerDetails(details.name || name);
        return Response.json({ ...details, suburb: details.suburb || reg.suburb, state: details.state || reg.state, website: site.url, source: "website", pagesRead: site.pagesRead } satisfies CentreProfileResponse);
      } catch (err) {
        // A URL the person typed must work; a website we found ourselves can fall back to the ad.
        if (url?.trim() || !text.trim()) throw err;
        siteError = describeError(err);
      }
    }
    if (text.trim()) {
      const details = await summarise(text.slice(0, 30_000), "job ad");
      const reg = await registerDetails(details.name || name);
      return Response.json({ ...details, suburb: details.suburb || reg.suburb, state: details.state || reg.state, website: "", source: "ad", note: siteError || undefined } satisfies CentreProfileResponse);
    }
    const reg = await registerDetails(name);
    return Response.json({ name, ...reg, website: "", curriculum: "", philosophy: "", programs: "", approaches: [], source: "none" } satisfies CentreProfileResponse);
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 400 });
  }
}
