import { Resolver } from "node:dns/promises";
import { clean } from "../feed/classify";
import { UA } from "./careers";
import { ownSite } from "./find-website";

// Finds a centre's website without a search API: tries the web addresses a centre's name usually becomes
// (e.g. "Wattle Grove Early Learning" -> wattlegrove.com.au, wattlegroveearlylearning.com.au) and only
// accepts one whose page shows the centre's phone number from the register, or its distinctive name.
// It finds a good share of sites for free; a search API (find-website.ts) finds more.

const LEGAL = /\b(the trustee for|trustee for|as trustee|atf|pty\.?|ltd\.?|limited|proprietary|inc\.?|incorporated|co-?operative|trust|t\/a|trading as|holdings|group|australia|aust)\b/g;
const GENERIC = new Set([
  "early", "learning", "centre", "center", "centres", "childcare", "child", "care", "children", "childrens", "kids", "education", "educational",
  "kindergarten", "kindy", "kinder", "preschool", "pre", "school", "long", "day", "elc", "and", "the", "of", "at", "services", "service", "cottage",
  "academy", "house", "oshc", "outside", "hours", "vacation", "before", "after", "family", "community", "inc", "association",
]);
const SUFFIXES = ["", "elc", "earlylearning", "childcare", "kids", "academy"];
const TLDS = ["com.au", "edu.au", "org.au", "net.au", "au"];
const PARKED = /domain (is )?(for sale|parked)|buy this domain|this domain may be for sale|parkingcrew|sedoparking|godaddy\.com\/domainsearch|domain has expired/i;
const ECE_PAGE = /child|early learning|kinder|kindy|preschool|oshc|educat|toddler|babies/i;

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(LEGAL, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

/** Likely domains for a centre or provider name, most likely first. */
export function candidateDomains(name: string, suburb = ""): string[] {
  // "The Trustee for Smith Family Trust T/A Little Gumnuts" -> the trading name.
  const trading = name.split(/\bt\/a\b|\btrading as\b/i).pop() ?? name;
  const all = words(trading);
  const place = new Set(words(suburb));
  const noPlace = all.filter((w) => !place.has(w));
  const core = noPlace.filter((w) => !GENERIC.has(w));
  const stems = new Set<string>();
  const add = (parts: string[]) => {
    const s = parts.join("");
    if (s.length >= 4 && s.length <= 40) stems.add(s);
  };
  add(all);
  add(noPlace);
  if (core.length) for (const suffix of SUFFIXES) add([...core, suffix]);
  if (all.length > 1) stems.add(all.join("-"));
  const out: string[] = [];
  // Nearly every centre uses .com.au: try every name with it, and the other endings only for the two most likely names.
  const list = Array.from(stems);
  for (const stem of list) out.push(`${stem}.com.au`);
  for (const tld of TLDS.slice(1)) for (const stem of list.slice(0, 2)) out.push(`${stem}.${tld}`);
  return Array.from(new Set(out)).slice(0, 16);
}

/** The words that identify this centre (not "early", "learning", "centre"...). */
export function distinctiveWords(name: string, suburb = ""): string[] {
  const place = new Set(words(suburb));
  return words(name).filter((w) => !GENERIC.has(w) && !place.has(w) && w.length >= 3);
}

const digits = (s: string) => s.replace(/\D/g, "");

/** True when the page belongs to this centre: its phone number or all of its distinctive name words appear. */
export function pageMatches(html: string, who: { names: string[]; suburb?: string; phones: string[] }): boolean {
  const text = clean(html).toLowerCase();
  if (PARKED.test(text) || !ECE_PAGE.test(text)) return false;
  const pageDigits = digits(html);
  for (const phone of who.phones) {
    const d = digits(phone).slice(-8);
    if (d.length === 8 && pageDigits.includes(d)) return true;
  }
  const squashed = text.replace(/[^a-z0-9]+/g, "");
  return who.names.some((name) => {
    const key = distinctiveWords(name, who.suburb);
    return key.length > 0 && key.join("").length >= 5 && key.every((w) => squashed.includes(w));
  });
}

// c-ares resolver: fast, and doesn't queue behind Node's small thread pool like dns.lookup.
const resolver = new Resolver({ timeout: 2_500, tries: 2 });
// Too many queries at once overload the DNS server and real domains start failing, so cap them.
const DNS_AT_ONCE = 64;
let inFlight = 0;
const waiting: (() => void)[] = [];
async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (inFlight >= DNS_AT_ONCE) await new Promise<void>((r) => waiting.push(r));
  inFlight += 1;
  try {
    return await work();
  } finally {
    inFlight -= 1;
    waiting.shift()?.();
  }
}
async function resolves(host: string) {
  return limited(() => lookupHost(host));
}
async function lookupHost(host: string) {
  try {
    return (await resolver.resolve4(host)).length > 0;
  } catch {
    try {
      return (await resolver.resolveCname(host)).length > 0;
    } catch {
      return false;
    }
  }
}

async function getPage(url: string, fetcher: typeof fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetcher(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: ctrl.signal });
    if (!res.ok || !/html/.test(res.headers.get("content-type") ?? "text/html")) return null;
    return { url: res.url || url, html: (await res.text()).slice(0, 600_000) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function guessWebsite(
  who: { names: string[]; suburb?: string; phones: string[] },
  deps: { fetcher?: typeof fetch; resolve?: (host: string) => Promise<boolean> } = {},
): Promise<{ url: string; domain: string } | null> {
  const fetcher = deps.fetcher ?? fetch;
  const resolve = deps.resolve ?? resolves;
  const candidates = Array.from(new Set(who.names.flatMap((name) => candidateDomains(name, who.suburb))));
  // Check which addresses exist, all at once (DNS is quick); keep the most likely order.
  const live = (
    await Promise.all(
      candidates.map(async (domain) => {
        // A domain with a website almost always resolves without "www" too.
        return (await resolve(domain)) ? domain : null;
      }),
    )
  ).filter((h): h is string => !!h);
  // Registered domains that happen to match a common word (e.g. rise.com.au) are ruled out by the page check.
  for (const host of live.slice(0, 5)) {
    const page = (await getPage(`https://${host}/`, fetcher)) ?? (await getPage(`http://${host}/`, fetcher));
    if (page && pageMatches(page.html, who)) {
      const site = ownSite(page.url);
      if (site) return site;
    }
  }
  return null;
}
