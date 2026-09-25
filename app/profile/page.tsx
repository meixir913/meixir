"use client";

import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, MapPin, ShieldCheck } from "lucide-react";
import { mergeResume } from "@/components/ResumeUpload";
import ResumeLibrary from "@/components/ResumeLibrary";
import { Button, Card, ChipToggle, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { AGE_GROUPS } from "@/lib/ece";
import { AU_STATES, EMPLOYMENT_TYPES, ROLE_TYPES } from "@/lib/jobtypes";
import { profileCompleteness, useProfile, useResumeLibrary } from "@/lib/storage";
import { EMPTY_PROFILE, type Profile } from "@/lib/types";
import { useT } from "@/lib/i18n";

const PROFILE_FIELDS = ["name", "email", "phone", "city", "credential", "registrationNumber", "yearsExperience", "certifications", "strengths", "personalPhilosophy"] as const;

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileEditor />
    </Suspense>
  );
}

function ProfileEditor() {
  const t = useT();
  const welcome = useSearchParams().get("welcome") === "1";
  const library = useResumeLibrary();
  const [stored, setStored, loaded] = useProfile();
  const [p, setP] = useState<Profile>(EMPTY_PROFILE);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (loaded) setP({ ...EMPTY_PROFILE, ...stored });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // The resume library updates the stored profile (default resume); keep this form in step.
  useEffect(() => {
    if (loaded) setP((x) => ({ ...x, resume: stored.resume, resumeFileName: stored.resumeFileName, defaultResumeId: stored.defaultResumeId }));
  }, [loaded, stored.resume, stored.resumeFileName, stored.defaultResumeId]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };

  function save() {
    setStored(p);
    setDirty(false);
    toast.success(t("Profile saved"));
  }

  const pct = profileCompleteness(p);
  const initials = p.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

  return (
    <>
      <PageHeader
        eyebrow={t("Used by every letter and interview")}
        heading="My <em>profile</em>"
        subtitle={t("Your resume and experience power every cover letter and interview prep session. Keep it current and reuse it for every application.")}
        action={
          <Button onClick={save} disabled={!dirty}>
            {dirty ? t("Save changes") : t("Saved")}
          </Button>
        }
      />

      {/* Snapshot */}
      <Card className="mb-6 grid gap-0 p-0 md:grid-cols-[1fr_280px]">
        <div className="flex flex-wrap items-center gap-5 p-6">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-500 font-display text-2xl font-semibold text-gold-400">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-3xl font-semibold leading-tight">{p.name || t("Your name")}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-body">
              {p.credential && (
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck size={14} className="text-gold-600" /> {p.credential}
                </span>
              )}
              {p.yearsExperience && <span>{t("{n} years in early childhood", { n: p.yearsExperience })}</span>}
              {p.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {p.city}
                </span>
              )}
              {!p.credential && !p.yearsExperience && !p.city && <span>{t("Upload your resume below to fill this in.")}</span>}
            </p>
            {(p.preferredRoles.length > 0 || p.preferredStates.length > 0) && (
              <p className="mt-2 flex flex-wrap gap-1.5">
                {[...p.preferredRoles, ...p.preferredStates].map((tag) => (
                  <span key={tag} className="rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-ink">
                    {t(tag)}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col justify-center gap-2 border-t border-line bg-cream/60 p-6 md:border-l md:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-600">{t("Profile strength")}</p>
          <p className="font-display text-4xl font-semibold leading-none lining-nums">{pct}%</p>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-500">{pct < 100 ? t("Add your resume, strengths and philosophy for stronger letters.") : t("Complete. Your letters have everything they need.")}</p>
        </div>
      </Card>

      {welcome && !library.resumes.length && (
        <div className="mb-6 rounded-md border border-gold-200 bg-gold-50 px-5 py-4 text-sm text-gold-700">
          <p className="font-semibold">{t("Welcome, {name}!", { name: (p.name || "").split(" ")[0] || t("there") })}</p>
          <p className="mt-1">{t("Start by uploading your resume. We'll read it and fill in your profile for you, so every cover letter and interview is ready to go.")}</p>
        </div>
      )}

      {/* Resumes */}
      <Card className="mb-6 space-y-4">
        <SectionTitle title={t("Resumes")} hint={t("Upload a resume and we'll fill in your profile from it automatically. Anything you've already typed is kept.")} />
        <ResumeLibrary
          library={library}
          onUploaded={(extract, resume) => {
            const next = { ...mergeResume(p, extract, resume.fileName), defaultResumeId: resume.id };
            setP(next);
            setStored(next);
            setDirty(false);
            const filled = PROFILE_FIELDS.filter((k) => !String(p[k] ?? "").trim() && String(next[k] ?? "").trim()).length + (!p.ageGroups.length && next.ageGroups.length ? 1 : 0);
            toast.success(t("Resume read"), {
              description: filled ? t("{n} profile details filled in from your resume. Check them below.", { n: filled }) : t("Saved to your resumes. Your profile details were already filled in."),
            });
          }}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <SectionTitle title={t("About you")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Full name")}>
              <Input value={p.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label={t("Suburb and state")}>
              <Input value={p.city} onChange={(e) => set("city", e.target.value)} placeholder={t("Parramatta NSW")} />
            </Field>
            <Field label={t("Email")}>
              <Input type="email" value={p.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label={t("Phone")}>
              <Input value={p.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>

          <SectionTitle title={t("Qualifications and checks")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Qualification")}>
              <Input value={p.credential} onChange={(e) => set("credential", e.target.value)} placeholder={t("Cert III, Diploma, Bachelor (ECT)…")} />
            </Field>
            <Field label={t("WWCC / teacher registration")} hint={t("optional")}>
              <Input value={p.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} />
            </Field>
            <Field label={t("Years in early childhood")}>
              <Input value={p.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} placeholder="4" inputMode="numeric" />
            </Field>
          </div>
          <Field label={t("Certifications")}>
            <Textarea rows={2} value={p.certifications} onChange={(e) => set("certifications", e.target.value)} placeholder={t("HLTAID012 first aid, asthma & anaphylaxis, child protection, food safety…")} />
          </Field>
          <Field label={t("Age groups you've worked with")} group>
            <ChipToggle options={AGE_GROUPS} selected={p.ageGroups} onChange={(v) => set("ageGroups", v)} />
          </Field>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <SectionTitle title={t("Your story")} hint={t("Specific moments make letters and interview answers stronger.")} />
            <Field label={t("Strengths and proud moments")}>
              <Textarea
                rows={4}
                value={p.strengths}
                onChange={(e) => set("strengths", e.target.value)}
                placeholder={t("e.g. Built a sensory garden with the toddlers; supported a child with autism through transitions using visual schedules; led our NQS Quality Area 6 family events")}
              />
            </Field>
            <Field label={t("Your philosophy of early learning")}>
              <Textarea rows={4} value={p.personalPhilosophy} onChange={(e) => set("personalPhilosophy", e.target.value)} placeholder={t("How you see children, how they learn best, and your role as an educator.")} />
            </Field>
          </Card>

          <Card className="space-y-4">
            <SectionTitle title={t("Job preferences")} hint={t("Sets your Job Vacancies filters and job alerts.")} />
            <Field label={t("States")} group>
              <ChipToggle options={AU_STATES.map((s) => s.id)} titles={Object.fromEntries(AU_STATES.map((s) => [s.id, s.name]))} selected={p.preferredStates} onChange={(v) => set("preferredStates", v)} />
            </Field>
            <Field label={t("Job types")} group>
              <ChipToggle options={ROLE_TYPES.filter((r) => r !== "Educator")} selected={p.preferredRoles} onChange={(v) => set("preferredRoles", v)} />
            </Field>
            <Field label={t("Employment")} group>
              <ChipToggle options={[...EMPLOYMENT_TYPES]} selected={p.preferredEmployment} onChange={(v) => set("preferredEmployment", v)} />
            </Field>
          </Card>
        </div>
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
        <ShieldCheck size={16} className="text-leaf-500" /> {t("Your profile and resumes are saved privately to your account. They're sent to the AI only when you write a letter or practise an interview.")}
      </p>

      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6 md:left-64">
          <div className="flex items-center gap-4 rounded-md bg-brand-500 px-5 py-3 text-sm text-white shadow-xl">
            {t("You have unsaved changes")}
            <Button onClick={save} className="bg-gold-500 !text-brand-500 hover:bg-gold-400">
              {t("Save changes")}
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
