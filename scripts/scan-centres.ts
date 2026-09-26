// Scans every approved service in the ACECQA register for open jobs, from your own computer or a server.
//
//   npx tsx --conditions=react-server scripts/scan-centres.ts [outDir] [--limit=N] [--phase=find|scan|all]
//
// 1. Downloads the register (about 18,000 services).
// 2. Finds each centre's or provider's website: a search API when BRAVE_SEARCH_API_KEY or
//    GOOGLE_PLACES_API_KEY is set, otherwise by trying the web addresses its name suggests.
// 3. Checks each website's careers page (respecting robots.txt) and records open roles.
//
// Progress is saved to outDir as it goes, so the script can be stopped and started again.
// Results: outDir/websites.json, outDir/scans.json. See scripts/export-centres.ts to add them to the site.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { downloadRegister } from "../lib/centres/acecqa";
import { scanSite } from "../lib/centres/careers";
import { findWebsite, finderConfigured } from "../lib/centres/find-website";
import { guessWebsite } from "../lib/centres/guess-website";
import { groupServices } from "../lib/centres/pipeline";
import type { Service } from "../lib/centres/types";

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith("--")) ?? "centre-scan";
const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? Infinity);
const phase = args.find((a) => a.startsWith("--phase="))?.split("=")[1] ?? "all";
mkdirSync(outDir, { recursive: true });

const file = (name: string) => path.join(outDir, name);
const load = <T>(name: string, fallback: T): T => (existsSync(file(name)) ? (JSON.parse(readFileSync(file(name), "utf8")) as T) : fallback);
const save = (name: string, data: unknown) => writeFileSync(file(name), JSON.stringify(data));

/** Gives up on one slow website instead of stalling the whole run. */
const within = <T, F>(ms: number, work: Promise<T>, fallback: F) => Promise.race<T | F>([work, new Promise<F>((r) => setTimeout(() => r(fallback), ms))]);

async function pool<T>(items: T[], size: number, task: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await task(items[i], i);
    }
  }));
}

async function main() {
  let services = load<Service[]>("register.json", []);
  if (!services.length) {
    console.log("Downloading the ACECQA register…");
    services = await downloadRegister();
    save("register.json", services);
  }
  console.log(`${services.length} services`);

  // ---------------------------------------------------------------- 1. Websites
  const groups = groupServices(services).slice(0, limit);
  const byProvider = new Map<string, Service[]>();
  for (const s of services) byProvider.set(s.providerId, [...(byProvider.get(s.providerId) ?? []), s]);
  const byId = new Map(services.map((s) => [s.id, s]));
  const websites = load<Record<string, { url: string; domain: string } | null>>("websites.json", {});

  if (phase !== "scan") {
    const todo = groups.filter((g) => !(g.key in websites));
    console.log(`Finding websites: ${todo.length} to look up (${finderConfigured() ? "search API" : "name matching"})`);
    let done = 0;
    let found = 0;
    await pool(todo, finderConfigured() ? 4 : 48, async (g) => {
      const members = g.kind === "provider" ? (byProvider.get(g.key.slice(2)) ?? []) : [byId.get(g.key.slice(2))!].filter(Boolean);
      // Try the centre's name, then its provider's (often the trading name, e.g. "NUKIDS PTY LTD").
      const names = g.kind === "provider" ? [g.name, ...Array.from(new Set(members.map((m) => m.name))).slice(0, 2)] : [g.name, members[0]?.provider ?? ""].filter(Boolean);
      try {
        const site = await within(90_000, finderConfigured()
          ? findWebsite(g.kind === "provider" ? `${g.name} early learning childcare` : `${g.name} ${g.location} childcare`)
          : guessWebsite({ names, suburb: g.kind === "service" ? members[0]?.suburb : "", phones: members.map((m) => m.phone).filter(Boolean).slice(0, 20) }), "timeout" as const);
        // A lookup that ran out of time is tried again next run.
        if (site !== "timeout") {
          websites[g.key] = site;
          if (site) found += 1;
        }
      } catch {
        websites[g.key] = null;
      }
      done += 1;
      if (done % 100 === 0 || done === todo.length) {
        save("websites.json", websites);
        console.log(`  ${done}/${todo.length} looked up, ${found} websites found`);
      }
    });
    save("websites.json", websites);
    const total = Object.values(websites).filter(Boolean).length;
    console.log(`Websites found: ${total} of ${Object.keys(websites).length} lookups`);
  }

  // ---------------------------------------------------------------- 2. Careers pages
  if (phase === "find") return;
  const sites = new Map<string, { homepage: string; name: string; states: Set<string>; serviceCount: number; location: string }>();
  for (const g of groups) {
    const site = websites[g.key];
    if (!site) continue;
    const entry = sites.get(site.domain) ?? { homepage: site.url, name: g.name, states: new Set<string>(), serviceCount: 0, location: g.location };
    g.states.forEach((s) => entry.states.add(s));
    entry.serviceCount += g.serviceCount;
    if (g.serviceCount > 1) entry.name = g.name;
    sites.set(site.domain, entry);
  }
  const scans = load<Record<string, Awaited<ReturnType<typeof scanSite>>>>("scans.json", {});
  const todo = Array.from(sites.entries()).filter(([domain]) => !(domain in scans));
  console.log(`Checking careers pages: ${todo.length} websites`);
  let done = 0;
  await pool(todo, 16, async ([domain, s]) => {
    const now = new Date().toISOString();
    const timedOut = { scan: { domain, homepage: s.homepage, name: s.name, states: Array.from(s.states), serviceCount: s.serviceCount, status: "unreachable" as const, careersUrl: null, portal: null, jobTitles: [], checkedAt: now, error: "timed out" }, jobs: [] };
    scans[domain] = await within(120_000, scanSite({
      domain,
      homepage: s.homepage,
      name: s.name,
      states: Array.from(s.states),
      serviceCount: s.serviceCount,
      location: s.serviceCount === 1 ? s.location : "",
      maxJobPages: s.serviceCount > 2 ? 30 : 10,
    }), timedOut);
    done += 1;
    if (done % 50 === 0) {
      save("scans.json", scans);
      const hiring = Object.values(scans).filter((r) => r.scan.status === "hiring").length;
      console.log(`  ${done}/${todo.length} checked, ${hiring} hiring`);
    }
  });
  save("scans.json", scans);
  const all = Object.values(scans);
  const count = (status: string) => all.filter((r) => r.scan.status === status).length;
  console.log(`Done. Hiring: ${count("hiring")}, recruitment page: ${count("portal")}, no openings: ${count("no-openings")}, no careers page: ${count("no-careers-page")}, unreachable: ${count("unreachable")}, blocked: ${count("blocked")}`);
  console.log(`Jobs found: ${all.reduce((n, r) => n + r.jobs.length, 0)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
