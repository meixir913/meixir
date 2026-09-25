"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_JOB_FIELDS, EMPTY_PROFILE, type CoverLetter, type InterviewSession, type Job, type Profile, type Resume } from "./types";
import type { UserDataKey } from "./user-data";

export { EMPTY_PROFILE };

// A job seeker's work (profile, resumes, applications, letters, interviews) is saved to their account
// and cached in this browser. Changes are written locally at once and uploaded shortly after.

const EVENT = "hireme-storage";

// Fill in fields added after data was first saved.
const NORMALISE: Record<string, (v: unknown) => unknown> = {
  "hireme.profile": (v) => ({ ...EMPTY_PROFILE, ...(v as Profile) }),
  "hireme.jobs": (v) => (v as Job[]).map((j) => ({ ...EMPTY_JOB_FIELDS, ...j })),
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return (NORMALISE[key] ? NORMALISE[key](parsed) : parsed) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T, upload = true) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode) — the account copy still saves.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
  if (upload) queueUpload(key, value);
}

// ---------------------------------------------------------------- Account sync

/** Browser keys that belong to the signed-in account. */
const SYNCED: Record<string, UserDataKey> = {
  "hireme.profile": "profile",
  "hireme.resumes": "resumes",
  "hireme.jobs": "jobs",
  "hireme.letters": "letters",
  "hireme.interviews": "interviews",
};
const OWNER_KEY = "hireme.owner";
let syncing = false;
const timers: Record<string, ReturnType<typeof setTimeout>> = {};

function queueUpload(key: string, value: unknown) {
  const dataKey = SYNCED[key];
  if (!syncing || !dataKey) return;
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    fetch(`/api/me/data?key=${dataKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
      keepalive: true,
    }).catch(() => {
      // Offline: the next change (or next sign-in) uploads it again.
    });
  }, 600);
}

/** Removes the signed-in person's data from this browser (on log out). */
export function clearLocalData() {
  syncing = false;
  for (const key of [...Object.keys(SYNCED), OWNER_KEY, "hireme.alerts"]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing stored.
    }
  }
}

/**
 * Loads the account's saved work into this browser. Data made in this browser before signing in
 * (or before accounts existed) is uploaded if the account has none yet.
 */
export async function startSync(user: { id: string; name: string; email: string }) {
  let owner: string | null = null;
  try {
    owner = window.localStorage.getItem(OWNER_KEY);
  } catch {
    // Storage blocked.
  }
  if (owner && owner !== user.id) clearLocalData();

  const res = await fetch("/api/me/data", { cache: "no-store" });
  const { data } = (await res.json()) as { data: Partial<Record<UserDataKey, unknown>> };
  syncing = true;
  for (const [key, dataKey] of Object.entries(SYNCED)) {
    const remote = data?.[dataKey];
    if (remote !== null && remote !== undefined) write(key, NORMALISE[key] ? NORMALISE[key](remote) : remote, false);
    else if (read(key, null) !== null) queueUpload(key, read(key, null));
  }
  // New accounts start with their name and email filled in.
  const profile = read<Profile>("hireme.profile", EMPTY_PROFILE);
  if (!profile.name || !profile.email) write("hireme.profile", { ...profile, name: profile.name || user.name, email: profile.email || user.email });
  try {
    window.localStorage.setItem(OWNER_KEY, user.id);
  } catch {
    // Storage blocked.
  }
}

/** useState backed by localStorage, kept in sync across components and tabs. */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setValue(read(key, fallback));
    setLoaded(true);
    const sync = (e: Event) => {
      const changed = e instanceof StorageEvent ? e.key : (e as CustomEvent<string>).detail;
      if (changed === key) setValue(read(key, fallback));
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
    // fallback is a literal default; re-reading on its identity change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(read(key, fallback)) : next;
      write(key, resolved);
      setValue(resolved);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, update, loaded] as const;
}


export const useProfile = () => useStored<Profile>("hireme.profile", EMPTY_PROFILE);
export const useJobs = () => useStored<Job[]>("hireme.jobs", []);
export const useLetters = () => useStored<CoverLetter[]>("hireme.letters", []);
export const useInterviews = () => useStored<InterviewSession[]>("hireme.interviews", []);

export const useResumes = () => useStored<Resume[]>("hireme.resumes", []);

/**
 * The saved resumes plus helpers. The default resume's text is mirrored into profile.resume,
 * which is what Interview Prep and older pages read.
 */
export function useResumeLibrary() {
  const [profile, setProfile, profileLoaded] = useProfile();
  const [resumes, setResumes, resumesLoaded] = useResumes();
  const loaded = profileLoaded && resumesLoaded;

  // Resumes saved before the library existed become its first entry.
  useEffect(() => {
    if (loaded && !resumes.length && profile.resume.trim()) {
      const first: Resume = { id: uid(), label: profile.resumeFileName || "My resume", fileName: profile.resumeFileName, text: profile.resume, uploadedAt: new Date().toISOString() };
      setResumes([first]);
      setProfile((p) => ({ ...p, defaultResumeId: first.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const defaultResume = resumes.find((r) => r.id === profile.defaultResumeId) ?? resumes[0] ?? null;

  const makeDefault = useCallback(
    (r: Resume) => setProfile((p) => ({ ...p, defaultResumeId: r.id, resume: r.text, resumeFileName: r.fileName })),
    [setProfile],
  );

  const add = useCallback(
    (r: Omit<Resume, "id" | "uploadedAt">) => {
      const saved: Resume = { ...r, id: uid(), uploadedAt: new Date().toISOString() };
      setResumes((list) => [saved, ...list]);
      return saved;
    },
    [setResumes],
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<Resume, "label" | "text">>) => {
      setResumes((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      if (patch.text !== undefined && id === defaultResume?.id) setProfile((p) => ({ ...p, resume: patch.text! }));
    },
    [setResumes, setProfile, defaultResume?.id],
  );

  const remove = useCallback(
    (id: string) => {
      const rest = resumes.filter((r) => r.id !== id);
      setResumes(rest);
      if (id === defaultResume?.id) {
        const next = rest[0];
        setProfile((p) => ({ ...p, defaultResumeId: next?.id ?? "", resume: next?.text ?? "", resumeFileName: next?.fileName ?? "" }));
      }
    },
    [resumes, setResumes, setProfile, defaultResume?.id],
  );

  return { resumes, defaultResume, loaded, add, update, remove, makeDefault };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function profileCompleteness(p: Profile): number {
  const fields = [p.name, p.email, p.credential, p.yearsExperience, p.strengths, p.personalPhilosophy, p.resume];
  const filled = fields.filter((f) => f.trim().length > 0).length + (p.ageGroups.length ? 1 : 0);
  return Math.round((filled / (fields.length + 1)) * 100);
}
