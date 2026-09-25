import type { RawJob } from "../types";
import indeed20260925 from "./indeed-2026-09-25.json";

// Jobs collected outside the daily run (for example with the Indeed connector) and committed here.
// They show in Job Vacancies alongside the collected feed until they are older than MAX_AGE_DAYS.
// To add a batch, drop a JSON file of the same shape in this folder and list it below.

export interface JobImport {
  source: string;
  importedAt: string;
  note?: string;
  jobs: RawJob[];
}

export const IMPORTS: JobImport[] = [indeed20260925 as JobImport];
