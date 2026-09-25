"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import type { ResumeExtract } from "@/lib/letter-types";
import type { Profile } from "@/lib/types";

/** Upload a resume (PDF, Word or text). It's read on the server and returned as profile details. */
export default function ResumeUpload({ onParsed, compact = false }: { onParsed: (extract: ResumeExtract, fileName: string) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: form });
      const data = (await res.json()) as ResumeExtract & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Couldn't read that resume.");
      onParsed(data, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that resume.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) upload(file);
        }}
        disabled={busy}
        className={`flex w-full items-center gap-3 rounded border border-dashed text-left transition focus-visible:outline-2 focus-visible:outline-gold-500 ${
          compact ? "px-3 py-2.5" : "px-4 py-5"
        } ${dragging ? "border-gold-500 bg-gold-50" : "border-brand-200 bg-white hover:border-gold-500"}`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-50 text-gold-600">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
        </span>
        <span>
          <span className="block text-sm font-semibold text-ink">{busy ? "Reading your resume…" : "Upload your resume"}</span>
          <span className="block text-xs text-slate-500">PDF, Word (.docx) or text · drag it here or click to browse · max 5 MB</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

/** Merges resume details into a profile, keeping anything the person already typed. */
export function mergeResume(profile: Profile, extract: ResumeExtract, fileName: string): Profile {
  const keep = (current: string, next: string) => (current.trim() ? current : next);
  return {
    ...profile,
    name: keep(profile.name, extract.name),
    email: keep(profile.email, extract.email),
    phone: keep(profile.phone, extract.phone),
    city: keep(profile.city, extract.city),
    credential: keep(profile.credential, extract.credential),
    registrationNumber: keep(profile.registrationNumber, extract.registrationNumber),
    yearsExperience: keep(profile.yearsExperience, extract.yearsExperience),
    certifications: keep(profile.certifications, extract.certifications),
    strengths: keep(profile.strengths, extract.strengths),
    personalPhilosophy: keep(profile.personalPhilosophy, extract.personalPhilosophy),
    ageGroups: profile.ageGroups.length ? profile.ageGroups : extract.ageGroups,
    resume: extract.resumeText,
    resumeFileName: fileName,
  };
}
