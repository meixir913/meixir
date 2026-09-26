import type { AuState } from "../feed/types";
import { groupServices, loadLookups, loadMeta, loadServices, loadSites } from "./pipeline";
import type { CentresMeta, Service, SiteScan, WebsiteLookup } from "./types";

// A committed copy of a full centre scan (register, websites found, careers-page results), made with
// scripts/scan-centres.ts and scripts/export-centres.ts. The site uses it until its own scheduled
// scanner has data, and the scanner starts from its websites instead of looking them all up again.

type Row = [id: string, name: string, providerId: string, provider: string, type: string, address: string, suburb: string, state: string, postcode: string, phone: string, places: number | null];

export interface Snapshot {
  scannedAt: string | null;
  registerUpdatedAt: string | null;
  services: Row[];
  /** Lookup key (p:<provider> or s:<service>) -> website. */
  lookups: Record<string, { url: string; domain: string }>;
  sites: SiteScan[];
}

export interface CentreData {
  source: "live" | "snapshot" | "sample";
  meta: CentresMeta;
  services: Record<string, Service>;
  lookups: Record<string, WebsiteLookup>;
  sites: Record<string, SiteScan>;
}

let cached: Omit<CentreData, "source"> | null | undefined;

export async function loadSnapshot(): Promise<Omit<CentreData, "source"> | null> {
  if (cached !== undefined) return cached;
  const snap = (await import("./snapshot.json")).default as unknown as Snapshot;
  if (!snap.services.length) return (cached = null);
  const services: Record<string, Service> = {};
  for (const [id, name, providerId, provider, type, address, suburb, state, postcode, phone, places] of snap.services) {
    services[id] = { id, name, providerId, provider, type, address, suburb, state: state as AuState | "", postcode, phone, places };
  }
  const lookups: Record<string, WebsiteLookup> = {};
  for (const g of groupServices(Object.values(services))) {
    const site = snap.lookups[g.key];
    lookups[g.key] = { ...g, url: site?.url ?? null, domain: site?.domain ?? null, lookedUpAt: snap.scannedAt };
  }
  cached = {
    meta: { registerUpdatedAt: snap.registerUpdatedAt, serviceCount: snap.services.length, lastRun: null },
    services,
    lookups,
    sites: Object.fromEntries(snap.sites.map((s) => [s.domain, s])),
  };
  return cached;
}

/** The scheduled scanner's data when it has run, otherwise the committed snapshot, otherwise nothing (sample centres). */
export async function loadCentreData(): Promise<CentreData> {
  const meta = await loadMeta();
  if (meta.serviceCount > 0) {
    const [services, lookups, sites] = await Promise.all([loadServices(), loadLookups(), loadSites()]);
    return { source: "live", meta, services, lookups, sites };
  }
  const snap = await loadSnapshot();
  if (snap) return { source: "snapshot", ...snap };
  return { source: "sample", meta, services: {}, lookups: {}, sites: {} };
}
