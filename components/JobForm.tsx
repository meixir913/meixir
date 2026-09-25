"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { PHILOSOPHIES, STATUSES } from "@/lib/ece";
import { AU_STATES, EMPLOYMENT_TYPES, ROLE_TYPES } from "@/lib/jobtypes";
import type { JobAnalysis } from "@/lib/prompts";
import type { Job, JobStatus } from "@/lib/types";
import { Button, ChipToggle, Field, Input, Select, Textarea } from "./ui";

export type JobDraft = Omit<Job, "id" | "createdAt" | "updatedAt">;

export const EMPTY_JOB: JobDraft = {
  title: "",
  centre: "",
  location: "",
  salary: "",
  url: "",
  description: "",
  centreInfo: "",
  philosophies: [],
  state: "",
  roleType: "",
  employmentType: "",
  centreCurriculum: "",
  centrePhilosophy: "",
  centrePrograms: "",
  status: "saved",
  notes: "",
  interviewDate: "",
};

export default function JobForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: JobDraft;
  onSave: (job: JobDraft) => void;
  onCancel: () => void;
}) {
  const [job, setJob] = useState<JobDraft>(initial);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof JobDraft>(k: K, v: JobDraft[K]) => setJob((j) => ({ ...j, [k]: v }));

  async function autofill() {
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/analyze-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: [job.description, job.centreCurriculum, job.centrePhilosophy, job.centrePrograms].join("\n\n") }),
      });
      const data = (await res.json()) as JobAnalysis & { error?: string };
      if (data.error) throw new Error(data.error);
      const known = new Set(PHILOSOPHIES.map((p) => p.name));
      setJob((j) => ({
        ...j,
        title: j.title || data.title,
        centre: j.centre || data.centre,
        location: j.location || data.location,
        salary: j.salary || data.salary,
        state: j.state || data.state,
        roleType: j.roleType || data.roleType,
        employmentType: j.employmentType || data.employmentType,
        philosophies: Array.from(new Set([...j.philosophies, ...data.philosophies.filter((p) => known.has(p))])),
        centreCurriculum: j.centreCurriculum || data.curriculum,
        centrePhilosophy: j.centrePhilosophy || data.philosophy,
        centrePrograms: j.centrePrograms || data.programs,
        centreInfo: j.centreInfo || (data.keywords.length ? `Key phrases: ${data.keywords.join(", ")}` : ""),
        notes:
          j.notes ||
          (data.requirements.length ? `Requirements:\n${data.requirements.map((r) => `• ${r}`).join("\n")}` : ""),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't analyse the posting.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(job);
      }}
    >
      <Field label="Job posting" hint="paste the full description">
        <Textarea
          rows={6}
          value={job.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Paste the job ad from SEEK, Indeed, a Facebook group or the centre's website"
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={autofill} disabled={analyzing || !job.description.trim()}>
          {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          Auto-fill from posting
        </Button>
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Job title">
          <Input value={job.title} onChange={(e) => set("title", e.target.value)} placeholder="Diploma Qualified Educator" required />
        </Field>
        <Field label="Centre / employer">
          <Input value={job.centre} onChange={(e) => set("centre", e.target.value)} placeholder="Little Sprouts Early Learning Centre" />
        </Field>
        <Field label="Location">
          <Input value={job.location} onChange={(e) => set("location", e.target.value)} placeholder="Parramatta NSW" />
        </Field>
        <Field label="Pay">
          <Input value={job.salary} onChange={(e) => set("salary", e.target.value)} placeholder="$32–$36/hour" />
        </Field>
        <Field label="Posting link">
          <Input value={job.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" type="url" />
        </Field>
        <Field label="Status">
          <Select value={job.status} onChange={(v) => set("status", v as JobStatus)} options={STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
        </Field>
        <Field label="State">
          <Select value={job.state} onChange={(v) => set("state", v)} options={[{ value: "", label: "Choose…" }, ...AU_STATES.map((s) => ({ value: s.id, label: s.name }))]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Job type">
            <Select value={job.roleType} onChange={(v) => set("roleType", v)} options={[{ value: "", label: "Choose…" }, ...ROLE_TYPES.map((r) => ({ value: r, label: r }))]} />
          </Field>
          <Field label="Employment">
            <Select value={job.employmentType} onChange={(v) => set("employmentType", v)} options={[{ value: "", label: "Choose…" }, ...EMPLOYMENT_TYPES.map((r) => ({ value: r, label: r }))]} />
          </Field>
        </div>
      </div>

      <p className="pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold-600">About the centre · used by your letter and interview rehearsal</p>
      <Field label="Curriculum" hint="frameworks and how they plan learning">
        <Textarea rows={2} value={job.centreCurriculum} onChange={(e) => set("centreCurriculum", e.target.value)} placeholder="e.g. EYLF V2.0, emergent and project-based, documented in Storypark" />
      </Field>
      <Field label="Philosophy" hint="in the centre's own words">
        <Textarea rows={2} value={job.centrePhilosophy} onChange={(e) => set("centrePhilosophy", e.target.value)} placeholder="e.g. Every child is capable and curious; families are our partners" />
      </Field>
      <Field label="Programs">
        <Textarea rows={2} value={job.centrePrograms} onChange={(e) => set("centrePrograms", e.target.value)} placeholder="e.g. Nursery, toddler and funded kindy rooms; weekly bush kinder" />
      </Field>
      <Field label="Pedagogical approach" group>
        <ChipToggle
          options={PHILOSOPHIES.map((p) => p.name)}
          titles={Object.fromEntries(PHILOSOPHIES.map((p) => [p.name, p.hint]))}
          selected={job.philosophies}
          onChange={(v) => set("philosophies", v)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Interview date">
          <Input type="datetime-local" value={job.interviewDate} onChange={(e) => set("interviewDate", e.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea rows={3} value={job.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Contacts, follow-ups, questions to ask…" />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save job</Button>
      </div>
    </form>
  );
}
