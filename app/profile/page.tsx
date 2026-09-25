"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, FileText, MapPin, ShieldCheck } from "lucide-react";
import ResumeUpload, { mergeResume } from "@/components/ResumeUpload";
import { Button, Card, ChipToggle, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { AGE_GROUPS } from "@/lib/ece";
import { AU_STATES, EMPLOYMENT_TYPES, ROLE_TYPES } from "@/lib/jobtypes";
import { profileCompleteness, useProfile } from "@/lib/storage";
import { EMPTY_PROFILE, type Profile } from "@/lib/types";

export default function ProfilePage() {
  const [stored, setStored, loaded] = useProfile();
  const [p, setP] = useState<Profile>(EMPTY_PROFILE);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (loaded) setP({ ...EMPTY_PROFILE, ...stored });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };

  function save() {
    setStored(p);
    setDirty(false);
    toast.success("Profile saved");
  }

  const pct = profileCompleteness(p);
  const initials = p.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

  return (
    <>
      <PageHeader
        eyebrow="Used by every letter and interview"
        title="Educator"
        accent="profile"
        subtitle="Your resume and experience power every cover letter and interview rehearsal. Keep it current and reuse it for every application."
        action={
          <Button onClick={save} disabled={!dirty}>
            {dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />

      {/* Snapshot */}
      <Card className="mb-6 grid gap-0 p-0 md:grid-cols-[1fr_280px]">
        <div className="flex flex-wrap items-center gap-5 p-6">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-500 font-display text-2xl font-semibold text-gold-400">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-3xl font-semibold leading-tight">{p.name || "Your name"}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-body">
              {p.credential && (
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck size={14} className="text-gold-600" /> {p.credential}
                </span>
              )}
              {p.yearsExperience && <span>{p.yearsExperience} years in early childhood</span>}
              {p.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {p.city}
                </span>
              )}
              {!p.credential && !p.yearsExperience && !p.city && <span>Upload your resume below to fill this in.</span>}
            </p>
            {(p.preferredRoles.length > 0 || p.preferredStates.length > 0) && (
              <p className="mt-2 flex flex-wrap gap-1.5">
                {[...p.preferredRoles, ...p.preferredStates].map((t) => (
                  <span key={t} className="rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-ink">
                    {t}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col justify-center gap-2 border-t border-line bg-cream/60 p-6 md:border-l md:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-600">Profile strength</p>
          <p className="font-display text-4xl font-semibold leading-none lining-nums">{pct}%</p>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-500">{pct < 100 ? "Add your resume, strengths and philosophy for stronger letters." : "Complete. Your letters have everything they need."}</p>
        </div>
      </Card>

      {/* Resume */}
      <Card className="mb-6 space-y-4">
        <SectionTitle title="Resume" hint="Upload it and we'll fill in your profile. Anything you've already typed is kept." />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <ResumeUpload
              onParsed={(extract, fileName) => {
                const next = mergeResume(p, extract, fileName);
                setP(next);
                setStored(next);
                setDirty(false);
                toast.success("Resume read", { description: "Your profile has been filled in and saved. Check the details below." });
              }}
            />
            {p.resumeFileName && (
              <p className="flex items-center gap-2 text-sm text-body">
                <FileText size={15} className="text-gold-600" /> Current resume: <b>{p.resumeFileName}</b>
              </p>
            )}
          </div>
          <Field label="Resume text" hint="what letters are written from; edit freely">
            <Textarea rows={8} value={p.resume} onChange={(e) => set("resume", e.target.value)} placeholder="Upload your resume, or paste it here." />
          </Field>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <SectionTitle title="About you" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={p.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Suburb and state">
              <Input value={p.city} onChange={(e) => set("city", e.target.value)} placeholder="Parramatta NSW" />
            </Field>
            <Field label="Email">
              <Input type="email" value={p.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={p.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>

          <SectionTitle title="Qualifications and checks" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Qualification">
              <Input value={p.credential} onChange={(e) => set("credential", e.target.value)} placeholder="Cert III, Diploma, Bachelor (ECT)…" />
            </Field>
            <Field label="WWCC / teacher registration" hint="optional">
              <Input value={p.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} />
            </Field>
            <Field label="Years in early childhood">
              <Input value={p.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} placeholder="4" inputMode="numeric" />
            </Field>
          </div>
          <Field label="Certifications">
            <Textarea rows={2} value={p.certifications} onChange={(e) => set("certifications", e.target.value)} placeholder="HLTAID012 first aid, asthma & anaphylaxis, child protection, food safety…" />
          </Field>
          <Field label="Age groups you've worked with" group>
            <ChipToggle options={AGE_GROUPS} selected={p.ageGroups} onChange={(v) => set("ageGroups", v)} />
          </Field>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <SectionTitle title="Your story" hint="Specific moments make letters and interview answers stronger." />
            <Field label="Strengths and proud moments">
              <Textarea
                rows={4}
                value={p.strengths}
                onChange={(e) => set("strengths", e.target.value)}
                placeholder="e.g. Built a sensory garden with the toddlers; supported a child with autism through transitions using visual schedules; led our NQS Quality Area 6 family events"
              />
            </Field>
            <Field label="Your philosophy of early learning">
              <Textarea rows={4} value={p.personalPhilosophy} onChange={(e) => set("personalPhilosophy", e.target.value)} placeholder="How you see children, how they learn best, and your role as an educator." />
            </Field>
          </Card>

          <Card className="space-y-4">
            <SectionTitle title="Job preferences" hint="Sets your Vacancies filters and job alerts." />
            <Field label="States" group>
              <ChipToggle options={AU_STATES.map((s) => s.id)} titles={Object.fromEntries(AU_STATES.map((s) => [s.id, s.name]))} selected={p.preferredStates} onChange={(v) => set("preferredStates", v)} />
            </Field>
            <Field label="Job types" group>
              <ChipToggle options={ROLE_TYPES.filter((r) => r !== "Educator")} selected={p.preferredRoles} onChange={(v) => set("preferredRoles", v)} />
            </Field>
            <Field label="Employment" group>
              <ChipToggle options={[...EMPLOYMENT_TYPES]} selected={p.preferredEmployment} onChange={(v) => set("preferredEmployment", v)} />
            </Field>
          </Card>
        </div>
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
        <ShieldCheck size={16} className="text-leaf-500" /> Your profile is stored only in this browser. It&apos;s sent to the AI only when you write a letter or get interview feedback, and never kept on our servers.
      </p>

      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6 md:left-64">
          <div className="flex items-center gap-4 rounded-md bg-brand-500 px-5 py-3 text-sm text-white shadow-xl">
            You have unsaved changes
            <Button onClick={save} className="bg-gold-500 !text-brand-500 hover:bg-gold-400">
              Save changes
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  );
}
