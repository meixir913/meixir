"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Download, FileText, Globe, Loader2, RefreshCw, Save, Search, Sparkles, Trash2 } from "lucide-react";
import ResumeUpload, { mergeResume } from "@/components/ResumeUpload";
import { Button, Card, ChipToggle, Field, Input, PageHeader, Select, Textarea, readTextStream } from "@/components/ui";
import { LETTER_TONES, PHILOSOPHIES, ROLES } from "@/lib/ece";
import { AU_STATES, EMPLOYMENT_TYPES, ROLE_TYPES, STATE_CONTEXT } from "@/lib/jobtypes";
import type { AuState } from "@/lib/feed/types";
import { EMPTY_CENTRE, EMPTY_ROLE, type Alignment, type AlignmentItem, type CentreDetails, type CentreProfileResponse, type RoleDetails } from "@/lib/letter-types";
import { uid, useJobs, useLetters, useProfile, useResumeLibrary } from "@/lib/storage";
import type { Job } from "@/lib/types";
import { useI18n, useT } from "@/lib/i18n";

const CATEGORY_LABEL: Record<AlignmentItem["category"], string> = {
  curriculum: "Curriculum",
  philosophy: "Philosophy",
  program: "Program",
  role: "Role",
};
const STRENGTH_STYLE: Record<AlignmentItem["strength"], string> = {
  strong: "bg-leaf-50 text-leaf-600",
  partial: "bg-gold-50 text-gold-700",
  gap: "bg-rose-50 text-rose-700",
};
const STRENGTH_LABEL: Record<AlignmentItem["strength"], string> = {
  strong: "Strong match",
  partial: "Partial match",
  gap: "Gap",
};
const STATE_RE = /\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i;
const looksLikeUrl = (s: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s.trim());

type Extraction =
  | { status: "idle" }
  | { status: "reading"; what: string }
  | {
      status: "done";
      source: CentreProfileResponse["source"];
      pages?: number;
      note?: string;
    }
  | { status: "error"; message: string };

export default function LettersPage() {
  return (
    <Suspense>
      <CoverLetterWizard />
    </Suspense>
  );
}

function CoverLetterWizard() {
  const t = useT();
  const { locale } = useI18n();
  const params = useSearchParams();
  const [profile, setProfile, profileLoaded] = useProfile();
  const library = useResumeLibrary();
  const [jobs, setJobs, jobsLoaded] = useJobs();
  const [letters, setLetters] = useLetters();

  const [resumeId, setResumeId] = useState("");

  const [jobId, setJobId] = useState("");
  const [centre, setCentre] = useState<CentreDetails>(EMPTY_CENTRE);
  const [role, setRole] = useState<RoleDetails>(EMPTY_ROLE);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [extraction, setExtraction] = useState<Extraction>({ status: "idle" });
  const extractRun = useRef(0);

  const [alignment, setAlignment] = useState<Alignment | null>(null);
  const [alignedFor, setAlignedFor] = useState("");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [mapping, setMapping] = useState(false);

  const [tone, setTone] = useState(LETTER_TONES[0]);
  const [length, setLength] = useState<"short" | "standard">("standard");
  const [extra, setExtra] = useState("");
  const [letter, setLetter] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The resume for this letter: chosen here, defaulting to the one marked default in My Profile.
  const resume = library.resumes.find((r) => r.id === resumeId) ?? library.defaultResume;
  const letterProfile = useMemo(() => ({ ...profile, resume: resume?.text ?? profile.resume }), [profile, resume]);
  const hasResume = letterProfile.resume.trim().length > 0;
  const hasCentre = Boolean(centre.curriculum.trim() || centre.philosophy.trim() || centre.programs.trim());
  const reading = extraction.status === "reading";
  // When the inputs change after mapping, the alignment is out of date.
  const signature = useMemo(() => JSON.stringify([resume?.id, letterProfile.resume.length, centre, role]), [resume?.id, letterProfile.resume.length, centre, role]);
  const alignmentStale = alignment !== null && alignedFor !== signature;

  // Arriving from Applications (?job=) or Centres Hiring (?centre=&website=).
  useEffect(() => {
    if (!jobsLoaded || !profileLoaded) return;
    const id = params.get("job");
    const name = params.get("centre");
    const site = params.get("website");
    if (id && jobs.some((j) => j.id === id)) {
      pickJob(id);
    } else if (name || site) {
      setCentre({
        ...EMPTY_CENTRE,
        name: name ?? "",
        state: params.get("state") ?? "",
        suburb: params.get("suburb") ?? "",
      });
      if (site) setWebsiteUrl(site);
      extract(
        {
          url: site ?? undefined,
          name: name ?? "",
          location: [params.get("suburb"), params.get("state")].filter(Boolean).join(" "),
        },
        name ?? site ?? "",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsLoaded, profileLoaded]);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ------------------------------------------------------------ Step 2: centre details, extracted automatically

  async function extract(input: { url?: string; name?: string; location?: string; text?: string }, what: string, jobToUpdate?: string) {
    const run = ++extractRun.current;
    setExtraction({ status: "reading", what });
    try {
      const res = await fetch("/api/centre-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as CentreProfileResponse & {
        error?: string;
      };
      if (run !== extractRun.current) return; // a newer request replaced this one
      if (!res.ok || data.error) throw new Error(data.error || "Couldn't read that website.");
      const merged = (c: CentreDetails): CentreDetails => ({
        name: c.name || data.name,
        suburb: c.suburb || data.suburb,
        state: c.state || data.state,
        website: data.website || c.website,
        curriculum: data.curriculum || c.curriculum,
        philosophy: data.philosophy || c.philosophy,
        programs: data.programs || c.programs,
        approaches: Array.from(new Set([...c.approaches, ...data.approaches])),
      });
      setCentre(merged);
      if (data.website) setWebsiteUrl(data.website);
      setExtraction({
        status: "done",
        source: data.source,
        pages: data.pagesRead,
        note: data.note,
      });
      // Remember what was learned with the saved job, for next time and for Interview Prep.
      if (jobToUpdate && data.source !== "none") {
        setJobs((all) =>
          all.map((j) =>
            j.id === jobToUpdate
              ? {
                  ...j,
                  website: data.website || j.website,
                  centreCurriculum: j.centreCurriculum || data.curriculum,
                  centrePhilosophy: j.centrePhilosophy || data.philosophy,
                  centrePrograms: j.centrePrograms || data.programs,
                  philosophies: Array.from(new Set([...j.philosophies, ...data.approaches])),
                  updatedAt: new Date().toISOString(),
                }
              : j,
          ),
        );
      }
    } catch (e) {
      if (run === extractRun.current)
        setExtraction({
          status: "error",
          message: e instanceof Error ? e.message : "Couldn't read that website.",
        });
    }
  }

  function pickJob(id: string) {
    setJobId(id);
    const j = jobs.find((x) => x.id === id);
    if (!j) {
      setCentre(EMPTY_CENTRE);
      setRole(EMPTY_ROLE);
      setWebsiteUrl("");
      setExtraction({ status: "idle" });
      return;
    }
    const fromJob: CentreDetails = {
      name: j.centre,
      suburb: j.location.replace(/\s*(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s*\d*$/i, "").replace(/,\s*$/, ""),
      state: j.state || (j.location.match(STATE_RE)?.[1].toUpperCase() ?? ""),
      website: j.website,
      curriculum: j.centreCurriculum,
      philosophy: j.centrePhilosophy || j.centreInfo,
      programs: j.centrePrograms,
      approaches: j.philosophies,
    };
    setCentre(fromJob);
    setWebsiteUrl(j.website);
    setRole({
      title: j.title,
      roleType: j.roleType,
      employmentType: j.employmentType,
      description: j.description,
    });
    const known = j.centreCurriculum || j.centrePhilosophy || j.centrePrograms;
    if (known) setExtraction({ status: "done", source: j.website ? "website" : "ad" });
    else autoExtractFor(j);
  }

  function autoExtractFor(j: Job) {
    extract(
      {
        url: j.website || undefined,
        name: j.centre,
        location: j.location,
        text: j.description,
      },
      j.centre || j.website || t("this job"),
      j.id,
    );
  }

  // Pasting or typing a website reads it automatically.
  useEffect(() => {
    const url = websiteUrl.trim();
    if (!url || !looksLikeUrl(url) || url === centre.website) return;
    const timer = setTimeout(() => extract({ url, name: centre.name, text: role.description }, url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), jobId || undefined), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteUrl]);

  // ------------------------------------------------------------ Steps 3 and 4

  async function mapFit(): Promise<Alignment | null> {
    setMapping(true);
    setError("");
    try {
      const res = await fetch("/api/alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: letterProfile, centre, role, locale }),
      });
      const data = (await res.json()) as Alignment & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Couldn't map the alignment.");
      setAlignment(data);
      setAlignedFor(signature);
      setExcluded(new Set(data.items.flatMap((item, i) => (item.strength === "gap" ? [i] : []))));
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't map the alignment.");
      return null;
    } finally {
      setMapping(false);
    }
  }

  // Once the centre's details have been read, map the fit straight away.
  useEffect(() => {
    if (extraction.status === "done" && hasResume && hasCentre && !mapping) mapFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraction]);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      let current = alignment;
      let skip = excluded;
      if (!current || alignmentStale) {
        current = await mapFit();
        if (!current) return;
        skip = new Set(current.items.flatMap((item, i) => (item.strength === "gap" ? [i] : [])));
      }
      setLetter("");
      setSavedId(null);
      const res = await fetch("/api/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: letterProfile,
          centre,
          role,
          alignment: current.items.filter((_, i) => !skip.has(i)),
          tone,
          length,
          extra,
        }),
      });
      await readTextStream(res, setLetter);
      if (jobId) {
        setJobs((all) =>
          all.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  website: centre.website || j.website,
                  centreCurriculum: centre.curriculum,
                  centrePhilosophy: centre.philosophy,
                  centrePrograms: centre.programs,
                  philosophies: centre.approaches,
                  state: centre.state,
                  roleType: role.roleType,
                  employmentType: role.employmentType,
                  updatedAt: new Date().toISOString(),
                }
              : j,
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  function save() {
    const id = savedId ?? uid();
    setLetters((all) => [
      {
        id,
        jobId: jobId || null,
        title: role.title || role.roleType || "Cover Letter",
        centre: centre.name,
        content: letter,
        createdAt: new Date().toISOString(),
      },
      ...all.filter((l) => l.id !== id),
    ]);
    setSavedId(id);
    toast.success(t("Letter saved"), {
      description: t("Find it under Saved letters below."),
    });
  }

  function download() {
    const blob = new Blob([letter], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Cover letter - ${centre.name || role.title || "ECE"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const steps = [
    { label: t("Resume"), done: hasResume },
    { label: t("Centre and role"), done: hasCentre && Boolean(centre.name) },
    { label: t("Alignment"), done: alignment !== null && !alignmentStale },
    { label: t("Letter"), done: letter.length > 0 && !generating },
  ];
  const current = steps.findIndex((s) => !s.done);
  const stateContext = STATE_CONTEXT[centre.state as AuState];
  const counts = alignment
    ? {
        strong: alignment.items.filter((i) => i.strength === "strong").length,
        partial: alignment.items.filter((i) => i.strength === "partial").length,
        gap: alignment.items.filter((i) => i.strength === "gap").length,
      }
    : null;

  return (
    <>
      <PageHeader
        eyebrow={t("Your resume, matched to one centre")}
        heading="Cover <em>Letter</em>"
        subtitle={t("Built from your resume and the centre's own curriculum, philosophy and programs. First see where your experience aligns, then get a letter that shows it.")}
      />

      {/* Progress */}
      <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t("Progress")}>
        {steps.map((s, i) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => go(i === 3 ? "letter-output" : `letter-step-${i + 1}`)}
              aria-current={i === current ? "step" : undefined}
              className={`flex w-full items-center gap-2 rounded border px-3 py-2.5 text-left text-sm font-semibold transition ${
                s.done ? "border-gold-200 bg-gold-50 text-ink" : i === current ? "border-brand-500 bg-white text-ink" : "border-line bg-white text-slate-500"
              }`}
            >
              {s.done ? (
                <CheckCircle2 size={17} className="shrink-0 text-gold-600" />
              ) : (
                <span className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border text-[10px] lining-nums ${i === current ? "border-brand-500" : "border-slate-300"}`}>
                  {i + 1}
                </span>
              )}
              {s.label}
            </button>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* ---------------------------------------------------------------- 1. Resume */}
          <Card id="letter-step-1" className="scroll-mt-6 space-y-5 p-6">
            <StepTitle n={1} title={t("Choose a resume")} hint={t("Everything in the letter comes from the resume you pick.")} />
            {library.resumes.length > 0 && (
              <div role="radiogroup" aria-label={t("Your resumes")} className="space-y-2">
                {library.resumes.map((r) => {
                  const selected = r.id === resume?.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setResumeId(r.id)}
                      className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition ${selected ? "border-gold-500 bg-gold-50 ring-1 ring-gold-500" : "border-line bg-white hover:border-brand-200"}`}
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-gold-600" : "border-slate-300"}`}>
                        {selected && <span className="h-2.5 w-2.5 rounded-full bg-gold-600" />}
                      </span>
                      <FileText size={18} className="shrink-0 text-gold-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{r.label}</span>
                        <span className="block text-xs text-slate-500">
                          {t("Uploaded {date}", {
                            date: new Date(r.uploadedAt).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }),
                          })}{" "}
                          ·{" "}
                          {t("{n} words", {
                            n: r.text.split(/\s+/).filter(Boolean).length,
                          })}
                        </span>
                      </span>
                      {r.id === library.defaultResume?.id && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-700">{t("Default")}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <div>
              {library.resumes.length > 0 && <p className="mb-2 text-sm font-semibold text-ink">{t("Or upload a new one")}</p>}
              <ResumeUpload
                compact={library.resumes.length > 0}
                onParsed={(extract, fileName) => {
                  const saved = library.add({
                    label: fileName.replace(/\.(pdf|docx|txt)$/i, ""),
                    fileName,
                    text: extract.resumeText,
                  });
                  setResumeId(saved.id);
                  if (!library.defaultResume) library.makeDefault(saved);
                  // Fill any empty profile details from the new resume.
                  setProfile((p) => ({
                    ...mergeResume(p, extract, fileName),
                    resume: p.resume || extract.resumeText,
                    resumeFileName: p.resumeFileName || fileName,
                    defaultResumeId: p.defaultResumeId || saved.id,
                  }));
                  toast.success(t("Resume added"), {
                    description: t("Saved to My Profile for next time."),
                  });
                }}
              />
            </div>
            <p className="text-xs text-slate-500">
              <Link href="/profile" className="font-semibold text-gold-700 underline-offset-4 hover:underline">
                {t("Manage resumes in My Profile")}
              </Link>
            </p>
          </Card>

          {/* ---------------------------------------------------------------- 2. Centre and role */}
          <Card id="letter-step-2" className="scroll-mt-6 space-y-5 p-6">
            <StepTitle n={2} title={t("The centre and role")} hint={t("Pick a saved job or paste the centre's website. We'll read its curriculum, philosophy and programs for you.")} />

            <div className="grid gap-4 rounded-md bg-cream p-4 sm:grid-cols-2">
              <Field label={t("From your saved jobs")}>
                <Select
                  value={jobId}
                  onChange={pickJob}
                  options={[
                    {
                      value: "",
                      label: jobs.length ? t("Choose a saved job…") : t("No saved jobs yet"),
                    },
                    ...jobs.map((j) => ({
                      value: j.id,
                      label: `${j.title}${j.centre ? ` · ${j.centre}` : ""}`,
                    })),
                  ]}
                />
              </Field>
              <Field label={t("Or the centre's website")}>
                <div className="relative">
                  <Globe size={15} className="absolute left-3 top-3 text-slate-400" />
                  <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder={t("wattlegrove.com.au")} className="pl-9" inputMode="url" />
                </div>
              </Field>
            </div>

            <ExtractionStatus
              extraction={extraction}
              canRetry={Boolean(centre.name || websiteUrl || role.description)}
              onRetry={() =>
                extract(
                  {
                    url: websiteUrl || undefined,
                    name: centre.name,
                    location: [centre.suburb, centre.state].join(" "),
                    text: role.description,
                  },
                  centre.name || websiteUrl,
                  jobId || undefined,
                )
              }
            />

            <fieldset disabled={reading} className="space-y-5 disabled:opacity-60">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("Centre name")}>
                  <div className="flex gap-2">
                    <Input value={centre.name} onChange={(e) => setCentre({ ...centre, name: e.target.value })} placeholder={t("Wattle Grove Early Learning")} />
                    {!hasCentre && centre.name.trim() && !websiteUrl.trim() && (
                      <Button
                        type="button"
                        variant="secondary"
                        title={t("Find this centre's details")}
                        aria-label={t("Find this centre's details")}
                        onClick={() =>
                          extract(
                            {
                              name: centre.name,
                              location: [centre.suburb, centre.state].join(" "),
                              text: role.description,
                            },
                            centre.name,
                            jobId || undefined,
                          )
                        }
                      >
                        <Search size={15} />
                      </Button>
                    )}
                  </div>
                </Field>
                <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                  <Field label={t("Suburb")}>
                    <Input value={centre.suburb} onChange={(e) => setCentre({ ...centre, suburb: e.target.value })} placeholder={t("Parramatta")} />
                  </Field>
                  <Field label={t("State")}>
                    <Select value={centre.state} onChange={(v) => setCentre({ ...centre, state: v })} options={[{ value: "", label: "—" }, ...AU_STATES.map((s) => ({ value: s.id, label: s.id }))]} />
                  </Field>
                </div>
                <Field label={t("Job title")}>
                  <Input value={role.title} onChange={(e) => setRole({ ...role, title: e.target.value })} list="role-titles" placeholder={t("Diploma Educator – Kindy Room")} />
                  <datalist id="role-titles">
                    {ROLES.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("Job type")}>
                    <Select
                      value={role.roleType}
                      onChange={(v) => setRole({ ...role, roleType: v })}
                      options={[{ value: "", label: t("Choose…") }, ...ROLE_TYPES.map((r) => ({ value: r, label: t(r) }))]}
                    />
                  </Field>
                  <Field label={t("Employment")}>
                    <Select
                      value={role.employmentType}
                      onChange={(v) => setRole({ ...role, employmentType: v })}
                      options={[
                        { value: "", label: t("Choose…") },
                        ...EMPLOYMENT_TYPES.map((r) => ({
                          value: r,
                          label: t(r),
                        })),
                      ]}
                    />
                  </Field>
                </div>
              </div>
              {stateContext && (
                <p className="text-xs text-slate-500">{t("{state}: the letter will reference {framework} where relevant.", { state: centre.state, framework: stateContext.framework })}</p>
              )}

              <div className="space-y-4 border-t border-line pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-600">{t("What this centre values · edit anything")}</p>
                <Field label={t("Curriculum")} hint={t("frameworks and how they plan learning")}>
                  <Textarea
                    rows={3}
                    value={centre.curriculum}
                    onChange={(e) => setCentre({ ...centre, curriculum: e.target.value })}
                    placeholder={t("e.g. EYLF V2.0 with an emergent, project-based approach; learning documented in Storypark; intentional teaching in the kindy room")}
                  />
                </Field>
                <Field label={t("Philosophy")} hint={t("in the centre's own words")}>
                  <Textarea
                    rows={3}
                    value={centre.philosophy}
                    onChange={(e) => setCentre({ ...centre, philosophy: e.target.value })}
                    placeholder={t("e.g. We see every child as capable and curious. The environment is the third teacher, and families are our partners.")}
                  />
                </Field>
                <Field label={t("Programs")}>
                  <Textarea
                    rows={2}
                    value={centre.programs}
                    onChange={(e) => setCentre({ ...centre, programs: e.target.value })}
                    placeholder={t("e.g. Nursery, toddler and funded kindy rooms; weekly bush kinder; Mandarin program; school readiness")}
                  />
                </Field>
                <Field label={t("Pedagogical approach")} group>
                  <ChipToggle
                    options={PHILOSOPHIES.map((p) => p.name)}
                    titles={Object.fromEntries(PHILOSOPHIES.map((p) => [p.name, p.hint]))}
                    selected={centre.approaches}
                    onChange={(v) => setCentre({ ...centre, approaches: v })}
                  />
                </Field>
                <details className="text-sm" open={!!role.description && !jobId}>
                  <summary className="cursor-pointer font-semibold text-ink">{t("Job description (optional)")}</summary>
                  <Textarea
                    rows={5}
                    className="mt-2"
                    value={role.description}
                    onChange={(e) => setRole({ ...role, description: e.target.value })}
                    placeholder={t("Paste the job ad for its specific requirements.")}
                  />
                </details>
              </div>
            </fieldset>

            {!hasCentre && !reading && <p className="text-xs text-slate-500">{t("Add at least one of the centre's curriculum, philosophy or programs.")}</p>}
          </Card>

          {/* ---------------------------------------------------------------- 3. Alignment */}
          <Card id="letter-step-3" className="scroll-mt-6 space-y-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <StepTitle n={3} title={t("Alignment map")} hint={t("Where your experience meets what this centre values. Untick anything you'd rather leave out.")} />
              <Button variant="secondary" onClick={mapFit} disabled={mapping || !hasResume || !hasCentre}>
                {mapping ? <Loader2 size={15} className="animate-spin" /> : alignment ? <RefreshCw size={15} /> : <Sparkles size={15} />}
                {alignment ? t("Map again") : t("Map my fit")}
              </Button>
            </div>
            {mapping ? (
              <div className="flex items-center gap-3 rounded-md bg-cream p-4 text-sm text-body">
                <Loader2 size={18} className="animate-spin text-gold-600" />{" "}
                {t("Comparing your resume with {centre}…", {
                  centre: centre.name || t("the centre"),
                })}
              </div>
            ) : alignment ? (
              <>
                {alignmentStale && <p className="rounded bg-gold-50 p-2.5 text-sm text-gold-700">{t("You've changed details since this map was made. Map again to update it.")}</p>}
                <p className="leading-relaxed text-body">{alignment.summary}</p>
                {counts && (
                  <p className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2.5 py-1 ${STRENGTH_STYLE.strong}`}>{t("{n} strong", { n: counts.strong })}</span>
                    <span className={`rounded-full px-2.5 py-1 ${STRENGTH_STYLE.partial}`}>{t("{n} partial", { n: counts.partial })}</span>
                    <span className={`rounded-full px-2.5 py-1 ${STRENGTH_STYLE.gap}`}>{t("{n} gaps", { n: counts.gap })}</span>
                  </p>
                )}
                <ul className="divide-y divide-line rounded-md border border-line">
                  {alignment.items.map((item, i) => {
                    const included = !excluded.has(i);
                    return (
                      <li key={i}>
                        <label className={`flex cursor-pointer gap-3 p-4 transition ${included ? "" : "bg-slate-50 opacity-70"}`}>
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() =>
                              setExcluded((s) => {
                                const next = new Set(s);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                return next;
                              })
                            }
                            className="mt-1 h-4 w-4 accent-brand-500"
                          />
                          <div className="min-w-0 flex-1 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t(CATEGORY_LABEL[item.category])}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STRENGTH_STYLE[item.strength]}`}>{t(STRENGTH_LABEL[item.strength])}</span>
                            </div>
                            <p className="mt-1 font-semibold text-ink">{item.centreElement}</p>
                            {item.evidence && <p className="mt-0.5 text-body">&ldquo;{item.evidence}&rdquo;</p>}
                            <p className="mt-1 text-xs text-slate-500">{item.framing}</p>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : !hasResume || !hasCentre ? (
              <p className="text-sm text-slate-500">{t("Add your resume and at least one of the centre's curriculum, philosophy or programs to map your fit.")}</p>
            ) : (
              <p className="text-sm text-slate-500">
                {t("You'll see each thing the centre values next to the evidence from your resume, rated strong, partial or gap. Choose which points the letter uses.")}
              </p>
            )}
          </Card>

          {/* ---------------------------------------------------------------- 4. Letter */}
          <Card id="letter-step-4" className="scroll-mt-6 space-y-5 p-6">
            <StepTitle n={4} title={t("Write the letter")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Tone")}>
                <Select
                  value={tone}
                  onChange={setTone}
                  options={LETTER_TONES.map((tone) => ({
                    value: tone,
                    label: t(tone),
                  }))}
                />
              </Field>
              <Field label={t("Length")}>
                <Select
                  value={length}
                  onChange={(v) => setLength(v as "short" | "standard")}
                  options={[
                    { value: "standard", label: t("Standard (~380 words)") },
                    { value: "short", label: t("Short (~250 words)") },
                  ]}
                />
              </Field>
            </div>
            <Field label={t("Anything else to mention?")} hint={t("optional")}>
              <Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={t("e.g. I speak Mandarin, I can start in two weeks, I live five minutes away")} />
            </Field>
            {error && <p className="rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <Button
              onClick={() => {
                generate();
                if (window.innerWidth < 1024) go("letter-output");
              }}
              disabled={generating || mapping || reading || !hasResume || !hasCentre}
              className="w-full py-3"
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {mapping ? t("Mapping your fit…") : generating ? t("Writing your letter…") : letter ? t("Write a new version") : t("Write my cover letter")}
            </Button>
            {(!hasResume || !hasCentre) && <p className="text-center text-xs text-slate-500">{t("Needs your resume and the centre's curriculum, philosophy or programs.")}</p>}
          </Card>
        </div>

        {/* ---------------------------------------------------------------- The letter */}
        <div id="letter-output" className="scroll-mt-6 lg:sticky lg:top-6">
          <Card className="flex min-h-[36rem] flex-col p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-4">
              <div className="mr-auto min-w-0 flex-1 basis-60">
                <h2 className="text-2xl font-semibold">{t("Your letter")}</h2>
                {centre.name && (
                  <p className="text-xs text-slate-500">
                    {t("For {centre}", { centre: centre.name })}
                    {role.title && ` · ${role.title}`}
                    {resume && ` · ${t("from {resume}", { resume: resume.label })}`}
                  </p>
                )}
              </div>
              {letter && !generating && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      navigator.clipboard.writeText(letter).then(
                        () => {
                          setCopied(true);
                          toast.success(t("Letter copied"));
                          setTimeout(() => setCopied(false), 1500);
                        },
                        () => toast.error(t("Couldn't copy. Select the text and copy it instead.")),
                      )
                    }
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />} {t("Copy")}
                  </Button>
                  <Button variant="ghost" onClick={download}>
                    <Download size={15} /> .txt
                  </Button>
                  <Button variant="secondary" onClick={save}>
                    <Save size={15} /> {savedId ? t("Saved") : t("Save")}
                  </Button>
                </>
              )}
            </div>
            <div className="px-6 py-6 sm:px-10 sm:py-8">
              {generating && !letter ? (
                <p className="flex items-center gap-3 text-sm text-body">
                  <Loader2 size={18} className="animate-spin text-gold-600" /> {mapping ? t("Mapping your fit…") : t("Writing your letter…")}
                </p>
              ) : generating ? (
                <div className="typing-caret whitespace-pre-wrap font-display text-[18px] leading-relaxed">{letter}</div>
              ) : letter ? (
                <textarea
                  value={letter}
                  onChange={(e) => {
                    setLetter(e.target.value);
                    setSavedId(null);
                  }}
                  className="field-sizing-content min-h-[28rem] w-full resize-none rounded border border-transparent p-1 font-display text-[18px] leading-relaxed outline-none focus:border-line"
                  aria-label={t("Your letter (editable)")}
                />
              ) : (
                <div className="py-16 text-center text-slate-400">
                  <FileText size={44} className="mx-auto mb-3 text-gold-400" />
                  <p className="font-display text-xl text-ink">{t("Your letter appears here")}</p>
                  <p className="mt-1 text-sm">{t("It's written from the alignment map, so every point is backed by your resume. You can edit it here afterwards.")}</p>
                </div>
              )}
            </div>
          </Card>
          {letter && !generating && (
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 size={16} className="text-leaf-500" /> {t("Click the letter to edit it. Save it to keep it with this application.")}
            </p>
          )}
        </div>
      </div>

      {letters.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 text-2xl font-semibold">{t("Saved letters")}</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {letters.map((l) => (
              <Card key={l.id} className="flex flex-col">
                <p className="font-semibold">{l.title}</p>
                <p className="text-sm text-slate-500">
                  {l.centre || "—"} · {new Date(l.createdAt).toLocaleDateString("en-AU")}
                </p>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-body">{l.content}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (l.jobId && jobs.some((j) => j.id === l.jobId)) pickJob(l.jobId);
                      setLetter(l.content);
                      setSavedId(l.id);
                      go("letter-output");
                    }}
                  >
                    {t("Open")}
                  </Button>
                  <Button
                    variant="danger"
                    aria-label={t("Delete letter")}
                    onClick={() => {
                      setLetters((all) => all.filter((x) => x.id !== l.id));
                      toast(t("Letter deleted"), {
                        action: {
                          label: t("Undo"),
                          onClick: () => setLetters((all) => [l, ...all]),
                        },
                      });
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ExtractionStatus({ extraction, canRetry, onRetry }: { extraction: Extraction; canRetry: boolean; onRetry: () => void }) {
  const t = useT();
  if (extraction.status === "idle") return null;
  if (extraction.status === "reading") {
    return (
      <p className="flex items-center gap-3 rounded-md border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-700" role="status">
        <Loader2 size={17} className="shrink-0 animate-spin" />{" "}
        {t("Reading about {what}: curriculum, philosophy and programs…", {
          what: extraction.what,
        })}
      </p>
    );
  }
  if (extraction.status === "error") {
    return (
      <p className="flex flex-wrap items-center gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
        <span className="flex-1">{extraction.message}</span>
        {canRetry && (
          <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-4">
            {t("Try again")}
          </button>
        )}
      </p>
    );
  }
  const message =
    extraction.source === "website"
      ? extraction.pages
        ? t("Filled in from the centre's website ({n} pages read). Check the details below.", { n: extraction.pages })
        : t("Filled in from the centre's website. Check the details below.")
      : extraction.source === "ad"
        ? t("We couldn't find the centre's website, so these details come from the job ad. Paste the website above for richer detail.")
        : t("We couldn't find this centre's website. Paste it above, or type what you know below.");
  return (
    <p
      className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${extraction.source === "website" ? "border-leaf-100 bg-leaf-50 text-leaf-600" : "border-gold-200 bg-gold-50 text-gold-700"}`}
      role="status"
    >
      <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> {message}
    </p>
  );
}

function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 font-display text-lg font-semibold text-gold-400 lining-nums">{n}</span>
      <div>
        <h2 className="text-2xl font-semibold leading-tight md:text-3xl">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
