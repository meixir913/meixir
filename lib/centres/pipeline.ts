import { addJobs } from "../feed/collect";
import { hashGetAll, hashReplace, hashSet, kvGet, kvSet } from "../kv";
import { downloadRegister } from "./acecqa";
import { scanSite } from "./careers";
import { findWebsite, finderConfigured } from "./find-website";
import type { RawJob } from "../feed/types";
import type { CentresMeta, Service, SiteScan, WebsiteLookup } from "./types";

// Centre scanner: ACECQA register → each centre's website → its careers page → open roles in the job feed.
// Every run does a bounded amount of work so it fits a serverless time limit; hourly runs work through
// all ~17,000 services and then keep re-checking websites every few days.

const KEYS = { services: "centres:services", lookups: "centres:lookups", sites: "centres:sites", meta: "centres:meta" };

const REGISTER_MAX_AGE_DAYS = 7;
const RESCAN_AFTER_DAYS = 3;
const RETRY_FAILED_LOOKUP_DAYS = 30;
/** Providers with at least this many services get one provider-level website lookup. */
const PROVIDER_GROUP_MIN = 3;

const days = (n: number) => n * 864e5;
const envInt = (name: string, fallback: number) => Number.parseInt(process.env[name] ?? "", 10) || fallback;

export const loadServices = () => hashGetAll<Service>(KEYS.services);
export const loadLookups = () => hashGetAll<WebsiteLookup>(KEYS.lookups);
export const loadSites = () => hashGetAll<SiteScan>(KEYS.sites);
export const loadMeta = async (): Promise<CentresMeta> =>
  (await kvGet<CentresMeta>(KEYS.meta)) ?? { registerUpdatedAt: null, serviceCount: 0, lastRun: null };

/** Groups services for website lookups: one per multi-service provider, otherwise one per service. */
export function groupServices(services: Service[]): Omit<WebsiteLookup, "url" | "domain" | "lookedUpAt">[] {
  const byProvider = new Map<string, Service[]>();
  for (const s of services) byProvider.set(s.providerId, [...(byProvider.get(s.providerId) ?? []), s]);
  const groups: Omit<WebsiteLookup, "url" | "domain" | "lookedUpAt">[] = [];
  for (const [providerId, list] of byProvider) {
    const states = Array.from(new Set(list.map((s) => s.state).filter(Boolean)));
    if (list.length >= PROVIDER_GROUP_MIN) {
      groups.push({ key: `p:${providerId}`, kind: "provider", name: list[0].provider || list[0].name, serviceCount: list.length, states, location: "" });
    } else {
      for (const s of list) {
        groups.push({ key: `s:${s.id}`, kind: "service", name: s.name, serviceCount: 1, states: s.state ? [s.state] : [], location: [s.suburb, s.state].filter(Boolean).join(" ") });
      }
    }
  }
  return groups;
}

const queryFor = (g: Pick<WebsiteLookup, "kind" | "name" | "location">) =>
  g.kind === "provider" ? `${g.name} early learning childcare` : `${g.name} ${g.location} childcare`;

/** Runs tasks with limited concurrency, stopping new ones once the deadline passes. */
async function pool<T>(items: T[], limit: number, deadline: number, task: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length && Date.now() < deadline) await task(items[next++]);
    }),
  );
}

export async function runCentres(opts: { fetcher?: typeof fetch; timeBudgetMs?: number } = {}) {
  const fetcher = opts.fetcher ?? fetch;
  const deadline = Date.now() + (opts.timeBudgetMs ?? 240_000);
  const now = new Date();
  const notes: string[] = [];
  const meta = await loadMeta();

  // 1. Refresh the register weekly.
  let registerRefreshed = false;
  let services = await loadServices();
  if (!meta.registerUpdatedAt || now.getTime() - new Date(meta.registerUpdatedAt).getTime() > days(REGISTER_MAX_AGE_DAYS)) {
    try {
      const fresh = await downloadRegister(fetcher);
      services = Object.fromEntries(fresh.map((s) => [s.id, s]));
      await hashReplace(KEYS.services, services);
      meta.registerUpdatedAt = now.toISOString();
      meta.serviceCount = fresh.length;
      registerRefreshed = true;
    } catch (err) {
      notes.push(`Register download failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // 2. Look up websites, biggest providers first.
  const lookups = await loadLookups();
  const groups = groupServices(Object.values(services));
  const newGroups: Record<string, WebsiteLookup> = {};
  for (const g of groups) {
    const existing = lookups[g.key];
    newGroups[g.key] = existing ? { ...existing, ...g } : { ...g, url: null, domain: null, lookedUpAt: null };
  }
  let lookedUp = 0;
  if (finderConfigured()) {
    const due = Object.values(newGroups)
      .filter((g) => !g.lookedUpAt || (!g.domain && now.getTime() - new Date(g.lookedUpAt).getTime() > days(RETRY_FAILED_LOOKUP_DAYS)))
      .sort((a, b) => b.serviceCount - a.serviceCount)
      .slice(0, envInt("CENTRE_LOOKUPS_PER_RUN", 200));
    await pool(due, 4, deadline, async (g) => {
      try {
        const site = await findWebsite(queryFor(g), fetcher);
        newGroups[g.key] = { ...g, url: site?.url ?? null, domain: site?.domain ?? null, lookedUpAt: new Date().toISOString(), error: undefined };
      } catch (err) {
        newGroups[g.key] = { ...g, lookedUpAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) };
      }
      lookedUp += 1;
    });
  } else {
    notes.push("Website lookups skipped: set GOOGLE_PLACES_API_KEY or BRAVE_SEARCH_API_KEY.");
  }
  await hashReplace(KEYS.lookups, newGroups);

  // 3. Scan websites not checked recently. Several services can share one website.
  const sites = await loadSites();
  const byDomain = new Map<string, WebsiteLookup[]>();
  for (const g of Object.values(newGroups)) if (g.domain) byDomain.set(g.domain, [...(byDomain.get(g.domain) ?? []), g]);
  const dueSites = Array.from(byDomain.entries())
    .filter(([domain]) => !sites[domain] || now.getTime() - new Date(sites[domain].checkedAt).getTime() > days(RESCAN_AFTER_DAYS))
    .sort(([a], [b]) => (sites[a]?.checkedAt ?? "").localeCompare(sites[b]?.checkedAt ?? ""))
    .slice(0, envInt("CENTRE_SCANS_PER_RUN", 150));

  const scanned: Record<string, SiteScan> = {};
  const jobs: RawJob[] = [];
  await pool(dueSites, 6, deadline, async ([domain, owners]) => {
    const main = owners.sort((a, b) => b.serviceCount - a.serviceCount)[0];
    const serviceCount = owners.reduce((n, g) => n + g.serviceCount, 0);
    const { scan, jobs: found } = await scanSite(
      {
        domain,
        homepage: main.url!,
        name: main.name,
        states: Array.from(new Set(owners.flatMap((g) => g.states))),
        serviceCount,
        location: serviceCount === 1 ? main.location : "",
      },
      fetcher,
    );
    scanned[domain] = scan;
    jobs.push(...found);
  });
  await hashSet(KEYS.sites, scanned);
  const { added } = jobs.length ? await addJobs(jobs) : { added: [] };

  meta.lastRun = { at: now.toISOString(), registerRefreshed, lookedUp, scanned: Object.keys(scanned).length, jobsAdded: added.length, notes };
  await kvSet(KEYS.meta, meta);
  return meta.lastRun;
}
