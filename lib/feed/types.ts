export type AuState = "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT";

export type RoleLevel =
  | "Educator (Cert III)"
  | "Diploma Educator"
  | "Early Childhood Teacher"
  | "Room / Educational Leader"
  | "Centre Director"
  | "OSHC"
  | "Cook"
  | "Educator";

/** Which kind of channel a listing came from. */
export type SourceKind = "job-board" | "provider" | "email-alert" | "community";

/** One ECE job collected into the shared daily feed. */
export interface FeedJob {
  id: string;
  title: string;
  employer: string;
  location: string;
  state: AuState | null;
  salary: string;
  employmentType: string;
  roleLevel: RoleLevel;
  url: string;
  description: string;
  sourceKind: SourceKind;
  /** Human-readable channel, e.g. "Adzuna", "Goodstart careers", "SEEK alert", "Facebook group". */
  source: string;
  postedAt: string;
  collectedAt: string;
}

/** What a source adapter returns before classification and de-duplication. */
export type RawJob = Omit<FeedJob, "id" | "state" | "roleLevel" | "collectedAt"> & {
  state?: AuState | null;
};

export interface SourceRun {
  source: string;
  ok: boolean;
  found: number;
  added: number;
  error?: string;
  at: string;
}

export interface FeedData {
  jobs: FeedJob[];
  runs: SourceRun[];
  lastCollectedAt: string | null;
}
