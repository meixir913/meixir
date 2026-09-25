"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_PROFILE, type CoverLetter, type InterviewSession, type Job, type Profile } from "./types";

export { EMPTY_PROFILE };

// Everything a job seeker enters stays in their own browser (localStorage).
// Nothing is saved on the server; the API routes only see what is sent per request.

const EVENT = "hireme-storage";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode) — the app still works for this visit.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
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

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function profileCompleteness(p: Profile): number {
  const fields = [p.name, p.email, p.credential, p.yearsExperience, p.strengths, p.personalPhilosophy, p.resume];
  const filled = fields.filter((f) => f.trim().length > 0).length + (p.ageGroups.length ? 1 : 0);
  return Math.round((filled / (fields.length + 1)) * 100);
}
