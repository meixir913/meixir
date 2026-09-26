// Turns the output of scripts/scan-centres.ts into data the site shows:
//   lib/centres/snapshot.json            register + websites + careers-page results (Centres Hiring)
//   lib/feed/imports/centres-<date>.json  open roles found on centre websites (Job Vacancies)
//
//   npx tsx --conditions=react-server scripts/export-centres.ts <scanDir>

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isEceJob } from "../lib/feed/classify";
import type { RawJob } from "../lib/feed/types";
import type { scanSite } from "../lib/centres/careers";
import type { Service } from "../lib/centres/types";

const dir = process.argv[2] ?? "centre-scan";
const read = <T>(name: string): T => JSON.parse(readFileSync(path.join(dir, name), "utf8")) as T;

const services = read<Service[]>("register.json");
const websites = read<Record<string, { url: string; domain: string } | null>>("websites.json");
const scans = read<Record<string, Awaited<ReturnType<typeof scanSite>>>>("scans.json");

const scannedAt = Object.values(scans).reduce((latest, r) => (r.scan.checkedAt > latest ? r.scan.checkedAt : latest), "");
const date = (scannedAt || new Date().toISOString()).slice(0, 10);

// Titles that are real roles, not sentences picked out of page text ("Join our team of educators!").
const ROLE = /educator|teacher|\bect\b|leader|director|manager|coordinator|cook|chef|oshc|assistant|trainee|diploma|cert(ificate)?|nominated supervisor|inclusion|2ic|kindergarten|nanny|administrat|receptionist|cleaner/i;
const SENTENCE = /\b(we'?re|we are|join|our team|hiring|looking for|opportunit|apply|click|welcome|about us|careers?)\b|[!?]/i;
const goodTitle = (t: string) => t.length >= 4 && t.length <= 100 && ROLE.test(t) && !SENTENCE.test(t);

const jobs: RawJob[] = [];
const seen = new Set<string>();
for (const { scan, jobs: found } of Object.values(scans)) {
  for (const j of found) {
    const title = j.title.replace(/\s+/g, " ").trim();
    const key = `${title.toLowerCase()}|${j.url}`;
    if (!goodTitle(title) || !isEceJob({ ...j, title }) || seen.has(key)) continue;
    seen.add(key);
    jobs.push({ ...j, title, employer: j.employer || scan.name, source: `${scan.name} website`, sourceKind: "provider", postedAt: j.postedAt || scan.checkedAt });
  }
}

const snapshot = {
  scannedAt: scannedAt || null,
  registerUpdatedAt: date,
  services: services.map((s) => [s.id, s.name, s.providerId, s.provider, s.type, s.address, s.suburb, s.state, s.postcode, s.phone, s.places]),
  lookups: Object.fromEntries(Object.entries(websites).filter((e): e is [string, { url: string; domain: string }] => !!e[1])),
  sites: Object.values(scans).map((r) => ({ ...r.scan, jobTitles: r.scan.jobTitles.filter(goodTitle).slice(0, 20) })),
};
writeFileSync("lib/centres/snapshot.json", JSON.stringify(snapshot));
writeFileSync(
  `lib/feed/imports/centres-${date}.json`,
  JSON.stringify({ source: "Centre websites", importedAt: scannedAt || new Date().toISOString(), note: "Open roles found on the careers pages of ACECQA-approved services.", jobs }, null, 1),
);

const count = (status: string) => snapshot.sites.filter((s) => s.status === status).length;
console.log(`Snapshot: ${services.length} services, ${Object.keys(snapshot.lookups).length} websites, ${snapshot.sites.length} sites checked (${count("hiring")} hiring, ${count("portal")} recruitment page)`);
console.log(`Jobs: ${jobs.length} -> lib/feed/imports/centres-${date}.json (add it to lib/feed/imports/index.ts)`);
