import type { AuState } from "../feed/types";

/** One approved education and care service from the ACECQA national register. */
export interface Service {
  id: string;
  name: string;
  providerId: string;
  provider: string;
  type: string;
  address: string;
  suburb: string;
  state: AuState | "";
  postcode: string;
  phone: string;
  places: number | null;
}

/**
 * A website lookup covers either a whole provider (when it runs several services, one search finds the
 * provider's site) or a single service.
 */
export interface WebsiteLookup {
  key: string;
  kind: "provider" | "service";
  name: string;
  serviceCount: number;
  states: string[];
  /** Suburb and state when the lookup is for one service. */
  location: string;
  url: string | null;
  domain: string | null;
  lookedUpAt: string | null;
  error?: string;
}

export type SiteStatus =
  | "hiring" // job listings found
  | "portal" // links to a recruitment system we can't read; open it to see roles
  | "no-openings" // careers page says there are no vacancies
  | "no-careers-page"
  | "unreachable"
  | "blocked"; // robots.txt asks crawlers not to visit

export interface SiteScan {
  domain: string;
  homepage: string;
  name: string;
  states: string[];
  serviceCount: number;
  status: SiteStatus;
  careersUrl: string | null;
  portal: string | null;
  jobTitles: string[];
  checkedAt: string;
  error?: string;
}

export interface CentresMeta {
  registerUpdatedAt: string | null;
  serviceCount: number;
  lastRun: {
    at: string;
    registerRefreshed: boolean;
    lookedUp: number;
    scanned: number;
    jobsAdded: number;
    notes: string[];
  } | null;
}
