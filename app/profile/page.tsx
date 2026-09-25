"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ShieldCheck } from "lucide-react";
import { Button, Card, ChipToggle, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { AGE_GROUPS } from "@/lib/ece";
import { profileCompleteness, useProfile } from "@/lib/storage";
import { EMPTY_PROFILE, type Profile } from "@/lib/types";

export default function ProfilePage() {
  const [stored, setStored, loaded] = useProfile();
  const [p, setP] = useState<Profile>(EMPTY_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loaded) setP({ ...EMPTY_PROFILE, ...stored });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setSaved(false);
  };

  function save() {
    setStored(p);
    setSaved(true);
    toast.success("Profile saved");
  }

  const pct = profileCompleteness(p);

  return (
    <>
      <PageHeader
        eyebrow="Used by every letter and interview"
        title="My"
        accent="Profile"
        subtitle="Your experience powers every cover letter and mock interview. Fill it in once and reuse it for every application."
        action={
          <Button onClick={save}>
            {saved ? <Check size={16} /> : null} {saved ? "Saved" : "Save profile"}
          </Button>
        }
      />

      <div className="mb-6 flex items-center gap-4">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-bold text-body">{pct}% complete</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">About you</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={p.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={p.city} onChange={(e) => set("city", e.target.value)} placeholder="Parramatta NSW" />
            </Field>
            <Field label="Email">
              <Input type="email" value={p.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={p.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>
          <h2 className="pt-2 text-2xl font-semibold">Credentials</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Qualification">
              <Input value={p.credential} onChange={(e) => set("credential", e.target.value)} placeholder="Cert III, Diploma, Bachelor of Education (ECT)…" />
            </Field>
            <Field label="WWCC / teacher registration" hint="optional">
              <Input value={p.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} />
            </Field>
            <Field label="Years of experience">
              <Input value={p.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} placeholder="4" />
            </Field>
          </div>
          <Field label="Certifications & checks">
            <Textarea
              rows={2}
              value={p.certifications}
              onChange={(e) => set("certifications", e.target.value)}
              placeholder="HLTAID012 first aid, asthma & anaphylaxis, Child Protection, Food Safety Supervisor…"
            />
          </Field>
          <Field label="Age groups you've worked with" group>
            <ChipToggle options={AGE_GROUPS} selected={p.ageGroups} onChange={(v) => set("ageGroups", v)} />
          </Field>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">Your story</h2>
          <Field label="Strengths & proud moments" hint="specific examples help most">
            <Textarea
              rows={4}
              value={p.strengths}
              onChange={(e) => set("strengths", e.target.value)}
              placeholder="e.g. Built a sensory garden with the toddlers; supported a child with autism through transitions using visual schedules; led our NQS Quality Area 6 family events…"
            />
          </Field>
          <Field label="Your philosophy of early learning">
            <Textarea
              rows={4}
              value={p.personalPhilosophy}
              onChange={(e) => set("personalPhilosophy", e.target.value)}
              placeholder="How you see children, how they learn best, and your role as an educator."
            />
          </Field>
          <Field label="Resume" hint="paste as text">
            <Textarea rows={8} value={p.resume} onChange={(e) => set("resume", e.target.value)} placeholder="Paste your resume here…" />
          </Field>
        </Card>
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
        <ShieldCheck size={16} className="text-leaf-500" /> Your profile is stored only in this browser. It&apos;s sent to the AI only when you generate a letter or feedback.
      </p>
      <div className="mt-4 flex justify-end">
        <Button onClick={save}>{saved ? "Saved ✓" : "Save profile"}</Button>
      </div>
    </>
  );
}
