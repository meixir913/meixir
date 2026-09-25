import type { FeedJob } from "../feed/types";
import { employmentKind } from "../jobtypes";
import type { AlertPrefs } from "./types";

/** True when a job fits someone's alert preferences. An empty list means "any". */
export function jobMatches(job: FeedJob, prefs: AlertPrefs): boolean {
  if (prefs.states.length && !(job.state && prefs.states.includes(job.state))) return false;
  if (prefs.roleTypes.length && !prefs.roleTypes.includes(job.roleLevel)) return false;
  if (prefs.employment.length) {
    const kind = employmentKind(job.employmentType, job.title, job.description);
    if (!kind || !prefs.employment.includes(kind)) return false;
  }
  const words = prefs.keywords
    .split(/[,;]/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  if (words.length) {
    const hay = `${job.title} ${job.employer} ${job.location}`.toLowerCase();
    if (!words.some((w) => hay.includes(w))) return false;
  }
  return true;
}

export function describePrefs(prefs: AlertPrefs): string {
  const parts = [
    prefs.roleTypes.length ? prefs.roleTypes.join(", ") : "All job types",
    prefs.states.length ? prefs.states.join(", ") : "all states",
    prefs.employment.length ? prefs.employment.join(", ").toLowerCase() : "",
    prefs.keywords.trim() ? `“${prefs.keywords.trim()}”` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}
