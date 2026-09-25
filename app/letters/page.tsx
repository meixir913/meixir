"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, Circle, Copy, Download, FileText, Globe, Loader2, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import ResumeUpload, { mergeResume } from "@/components/ResumeUpload";
import { Button, Card, ChipToggle, Field, Input, PageHeader, Select, Textarea, readTextStream } from "@/components/ui";
import { LETTER_TONES, PHILOSOPHIES, ROLES } from "@/lib/ece";
import { AU_STATES, EMPLOYMENT_TYPES, ROLE_TYPES, STATE_CONTEXT } from "@/lib/jobtypes";
import type { AuState } from "@/lib/feed/types";
import { EMPTY_CENTRE, EMPTY_ROLE, type Alignment, type AlignmentItem, type CentreDetails, type RoleDetails } from "@/lib/letter-types";
import { uid, useJobs, useLetters, useProfile } from "@/lib/storage";

const CATEGORY_LABEL: Record<AlignmentItem["category"], string> = { curriculum: "Curriculum", philosophy: "Philosophy", program: "Program", role: "Role" };
const STRENGTH_STYLE: Record<AlignmentItem["strength"], string> = {
  strong: "bg-leaf-50 text-leaf-600",
  partial: "bg-gold-50 text-gold-700",
  gap: "bg-rose-50 text-rose-700",
};
const STRENGTH_LABEL: Record<AlignmentItem["strength"], string> = { strong: "Strong match", partial: "Partial match", gap: "Gap" };

export default function LettersPage() {
  return (
    <Suspense>
      <CentreMatchLetter />
    </Suspense>
  );
}

function CentreMatchLetter() {
  const params = useSearchParams();
  const [profile, setProfile, profileLoaded] = useProfile();
  const [jobs, setJobs, jobsLoaded] = useJobs();
  const [letters, setLetters] = useLetters();

  const [jobId, setJobId] = useState("");
  const [centre, setCentre] = useState<CentreDetails>(EMPTY_CENTRE);
  const [role, setRole] = useState<RoleDetails>(EMPTY_ROLE);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [importing, setImporting] = useState(false);

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
  const outputRef = useRef<HTMLDivElement>(null);

  const hasResume = profileLoaded && profile.resume.trim().length > 0;
  const hasCentre = Boolean(centre.curriculum.trim() || centre.philosophy.trim() || centre.programs.trim());
  // When the inputs change after mapping, the alignment is out of date.
  const signature = useMemo(() => JSON.stringify([profile.resume.length, centre, role]), [profile.resume.length, centre, role]);
  const alignmentStale = alignment !== null && alignedFor !== signature;

  useEffect(() => {
    const id = params.get("job");
    if (jobsLoaded && id && jobs.some((j) => j.id === id)) pickJob(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsLoaded]);

  function pickJob(id: string) {
    setJobId(id);
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    setCentre({
      name: j.centre,
      suburb: j.location.replace(/\s*(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s*\d*$/i, "").replace(/,\s*$/, ""),
      state: j.state || (j.location.match(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i)?.[1].toUpperCase() ?? ""),
      website: "",
      curriculum: j.centreCurriculum,
      philosophy: j.centrePhilosophy || j.centreInfo,
      programs: j.centrePrograms,
      approaches: j.philosophies,
    });
    setRole({ title: j.title, roleType: j.roleType, employmentType: j.employmentType, description: j.description });
  }

  async function importWebsite() {
    setImporting(true);
    try {
      const res = await fetch("/api/centre-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: websiteUrl }) });
      const data = (await res.json()) as CentreDetails & { error?: string; pagesRead?: number };
      if (!res.ok || data.error) throw new Error(data.error || "Couldn't read that website.");
      setCentre((c) => ({
        name: c.name || data.name,
        suburb: c.suburb || data.suburb,
        state: c.state || data.state,
        website: data.website,
        curriculum: c.curriculum || data.curriculum,
        philosophy: c.philosophy || data.philosophy,
        programs: c.programs || data.programs,
        approaches: Array.from(new Set([...c.approaches, ...data.approaches])),
      }));
      toast.success("Centre details imported", { description: `Read ${data.pagesRead ?? 1} page${data.pagesRead === 1 ? "" : "s"}. Anything you'd already typed was kept. Check and edit below.` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that website.");
    } finally {
      setImporting(false);
    }
  }

  async function mapFit(): Promise<Alignment | null> {
    setMapping(true);
    setError("");
    try {
      const res = await fetch("/api/alignment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, centre, role }) });
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
      outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const res = await fetch("/api/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, centre, role, alignment: current.items.filter((_, i) => !skip.has(i)), tone, length, extra }),
      });
      await readTextStream(res, setLetter);
      // Keep what was learned about the centre with the saved application, for Interview Rehearsal too.
      if (jobId) {
        setJobs((all) =>
          all.map((j) =>
            j.id === jobId
              ? { ...j, centreCurriculum: centre.curriculum, centrePhilosophy: centre.philosophy, centrePrograms: centre.programs, philosophies: centre.approaches, state: centre.state, roleType: role.roleType, employmentType: role.employmentType, updatedAt: new Date().toISOString() }
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
      { id, jobId: jobId || null, title: role.title || role.roleType || "Cover letter", centre: centre.name, content: letter, createdAt: new Date().toISOString() },
      ...all.filter((l) => l.id !== id),
    ]);
    setSavedId(id);
    toast.success("Letter saved", { description: "Find it under Saved letters below." });
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
    { label: "Resume", done: hasResume },
    { label: "Centre", done: hasCentre && Boolean(centre.name) },
    { label: "Alignment", done: alignment !== null && !alignmentStale },
    { label: "Letter", done: letter.length > 0 && !generating },
  ];
  const stateContext = STATE_CONTEXT[centre.state as AuState];
  const counts = alignment ? { strong: alignment.items.filter((i) => i.strength === "strong").length, partial: alignment.items.filter((i) => i.strength === "partial").length, gap: alignment.items.filter((i) => i.strength === "gap").length } : null;

  return (
    <>
      <PageHeader
        eyebrow="Your resume, matched to one centre"
        title="Cover"
        accent="Letter"
        subtitle="Built from your resume and the centre's own curriculum, philosophy and programs. First see where your experience aligns, then get a letter that shows it."
      />

      <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s.label} className={`flex items-center gap-2 rounded border px-3 py-2.5 text-sm ${s.done ? "border-gold-200 bg-gold-50 text-ink" : "border-line bg-white text-slate-500"}`}>
            {s.done ? <CheckCircle2 size={17} className="text-gold-600" /> : <Circle size={17} />}
            <span className="font-semibold">
              {i + 1}. {s.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* 1. Resume */}
          <Card className="space-y-4">
            <StepTitle n={1} title="Your resume" hint="Everything in the letter comes from here." />
            {hasResume ? (
              <div className="flex flex-wrap items-center gap-3 rounded bg-cream p-3 text-sm">
                <FileText size={18} className="text-gold-600" />
                <span className="min-w-0 flex-1">
                  <b>{profile.resumeFileName || "Resume from your Educator Profile"}</b>
                  <span className="block text-slate-500">
                    {profile.resume.trim().split(/\s+/).length.toLocaleString()} words
                    {profile.credential && ` · ${profile.credential}`}
                    {profile.yearsExperience && ` · ${profile.yearsExperience} years`}
                  </span>
                </span>
                <Link href="/profile" className="border-b border-ink text-sm font-semibold">
                  Edit profile
                </Link>
              </div>
            ) : (
              <p className="text-sm text-body">Upload your resume once. It&apos;s saved to your Educator Profile and reused for every letter.</p>
            )}
            <ResumeUpload
              compact={hasResume}
              onParsed={(extract, fileName) => {
                setProfile(mergeResume(profile, extract, fileName));
                toast.success(hasResume ? "Resume replaced" : "Resume added", { description: "Saved to your Educator Profile." });
              }}
            />
          </Card>

          {/* 2. Centre */}
          <Card className="space-y-4">
            <StepTitle n={2} title="The centre and role" hint="The more specific, the stronger the match." />
            {jobs.length > 0 && (
              <Field label="Start from a saved application">
                <Select
                  value={jobId}
                  onChange={pickJob}
                  options={[{ value: "", label: "— Enter a centre —" }, ...jobs.map((j) => ({ value: j.id, label: `${j.title} · ${j.centre || "Unnamed centre"}` }))]}
                />
              </Field>
            )}
            <div className="rounded bg-cream p-3">
              <Field label="Import from the centre's website" hint="reads its about, philosophy and program pages">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe size={15} className="absolute left-3 top-3 text-slate-400" />
                    <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="wattlegrove.com.au" className="pl-9" />
                  </div>
                  <Button type="button" variant="secondary" onClick={importWebsite} disabled={importing || !websiteUrl.trim()}>
                    {importing ? <Loader2 size={15} className="animate-spin" /> : null} Import
                  </Button>
                </div>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Centre name">
                <Input value={centre.name} onChange={(e) => setCentre({ ...centre, name: e.target.value })} placeholder="Wattle Grove Early Learning" />
              </Field>
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <Field label="Suburb">
                  <Input value={centre.suburb} onChange={(e) => setCentre({ ...centre, suburb: e.target.value })} placeholder="Parramatta" />
                </Field>
                <Field label="State">
                  <Select value={centre.state} onChange={(v) => setCentre({ ...centre, state: v })} options={[{ value: "", label: "—" }, ...AU_STATES.map((s) => ({ value: s.id, label: s.id }))]} />
                </Field>
              </div>
              <Field label="Job title">
                <Input value={role.title} onChange={(e) => setRole({ ...role, title: e.target.value })} list="role-titles" placeholder="Diploma Educator – Kindy Room" />
                <datalist id="role-titles">
                  {ROLES.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Job type">
                  <Select value={role.roleType} onChange={(v) => setRole({ ...role, roleType: v })} options={[{ value: "", label: "Choose…" }, ...ROLE_TYPES.map((r) => ({ value: r, label: r }))]} />
                </Field>
                <Field label="Employment">
                  <Select value={role.employmentType} onChange={(v) => setRole({ ...role, employmentType: v })} options={[{ value: "", label: "Choose…" }, ...EMPLOYMENT_TYPES.map((r) => ({ value: r, label: r }))]} />
                </Field>
              </div>
            </div>
            {stateContext && (
              <p className="text-xs text-slate-500">
                {centre.state}: the letter will reference {stateContext.framework}
                {role.roleType === "Early Childhood Teacher" && ` and ${stateContext.teacherRegistration}`} where relevant.
              </p>
            )}
            <Field label="Curriculum" hint="frameworks and how they plan learning">
              <Textarea rows={3} value={centre.curriculum} onChange={(e) => setCentre({ ...centre, curriculum: e.target.value })} placeholder="e.g. EYLF V2.0 with an emergent, project-based approach; learning documented in Storypark; intentional teaching in the kindy room" />
            </Field>
            <Field label="Philosophy" hint="in the centre's own words">
              <Textarea rows={3} value={centre.philosophy} onChange={(e) => setCentre({ ...centre, philosophy: e.target.value })} placeholder="e.g. We see every child as capable and curious. The environment is the third teacher, and families are our partners." />
            </Field>
            <Field label="Programs">
              <Textarea rows={2} value={centre.programs} onChange={(e) => setCentre({ ...centre, programs: e.target.value })} placeholder="e.g. Nursery, toddler and funded kindy rooms; weekly bush kinder; Mandarin program; school readiness" />
            </Field>
            <Field label="Pedagogical approach" group>
              <ChipToggle options={PHILOSOPHIES.map((p) => p.name)} titles={Object.fromEntries(PHILOSOPHIES.map((p) => [p.name, p.hint]))} selected={centre.approaches} onChange={(v) => setCentre({ ...centre, approaches: v })} />
            </Field>
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-ink">Job description (optional)</summary>
              <Textarea rows={5} className="mt-2" value={role.description} onChange={(e) => setRole({ ...role, description: e.target.value })} placeholder="Paste the job ad for its specific requirements." />
            </details>
          </Card>

          {/* 3. Alignment */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <StepTitle n={3} title="Alignment map" hint="Where your experience meets what this centre values." />
              <Button variant="secondary" onClick={mapFit} disabled={mapping || !hasResume || !hasCentre}>
                {mapping ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {alignment ? "Map again" : "Map my fit"}
              </Button>
            </div>
            {!hasResume || !hasCentre ? (
              <p className="text-sm text-slate-500">Add your resume and at least one of the centre&apos;s curriculum, philosophy or programs to map your fit.</p>
            ) : !alignment ? (
              <p className="text-sm text-slate-500">You&apos;ll see each thing the centre values next to the evidence from your resume, rated strong, partial or gap. Choose which points the letter uses.</p>
            ) : (
              <>
                {alignmentStale && <p className="rounded bg-gold-50 p-2.5 text-sm text-gold-700">You&apos;ve changed details since this map was made. Map again to update it.</p>}
                <p className="text-sm text-body">{alignment.summary}</p>
                {counts && (
                  <p className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2 py-0.5 ${STRENGTH_STYLE.strong}`}>{counts.strong} strong</span>
                    <span className={`rounded-full px-2 py-0.5 ${STRENGTH_STYLE.partial}`}>{counts.partial} partial</span>
                    <span className={`rounded-full px-2 py-0.5 ${STRENGTH_STYLE.gap}`}>{counts.gap} gap{counts.gap === 1 ? "" : "s"}</span>
                  </p>
                )}
                <ul className="divide-y divide-line rounded border border-line">
                  {alignment.items.map((item, i) => {
                    const included = !excluded.has(i);
                    return (
                      <li key={i} className="flex gap-3 p-3">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => setExcluded((s) => {
                            const next = new Set(s);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          })}
                          className="mt-1 h-4 w-4 accent-brand-500"
                          aria-label={`Use "${item.centreElement}" in the letter`}
                        />
                        <div className="min-w-0 flex-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{CATEGORY_LABEL[item.category]}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STRENGTH_STYLE[item.strength]}`}>{STRENGTH_LABEL[item.strength]}</span>
                          </div>
                          <p className="mt-1 font-semibold text-ink">{item.centreElement}</p>
                          {item.evidence && <p className="mt-0.5 text-body">&ldquo;{item.evidence}&rdquo;</p>}
                          <p className="mt-1 text-xs text-slate-500">{item.framing}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>

          {/* 4. Style */}
          <Card className="space-y-4">
            <StepTitle n={4} title="Write the letter" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tone">
                <Select value={tone} onChange={setTone} options={LETTER_TONES.map((t) => ({ value: t, label: t }))} />
              </Field>
              <Field label="Length">
                <Select
                  value={length}
                  onChange={(v) => setLength(v as "short" | "standard")}
                  options={[
                    { value: "standard", label: "Standard (~380 words)" },
                    { value: "short", label: "Short (~250 words)" },
                  ]}
                />
              </Field>
            </div>
            <Field label="Anything else to mention?" hint="optional">
              <Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. I speak Mandarin, I can start in two weeks, I live five minutes away" />
            </Field>
            {error && <p className="rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <Button onClick={generate} disabled={generating || mapping || !hasResume || !hasCentre} className="w-full py-3">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {mapping ? "Mapping your fit…" : generating ? "Writing your letter…" : letter ? "Write a new version" : "Write my cover letter"}
            </Button>
            {(!hasResume || !hasCentre) && <p className="text-center text-xs text-slate-500">Needs your resume and the centre&apos;s curriculum, philosophy or programs.</p>}
          </Card>
        </div>

        <div ref={outputRef} className="scroll-mt-6">
          <div className="xl:sticky xl:top-6">
            <Card className="flex min-h-[36rem] flex-col">
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
                <div className="mr-auto">
                  <h2 className="text-2xl font-semibold">Your letter</h2>
                  {centre.name && <p className="text-xs text-slate-500">For {centre.name}{role.title && ` · ${role.title}`}</p>}
                </div>
                {letter && !generating && (
                  <>
                    <Button variant="ghost" onClick={generate} title="Write a new version" aria-label="Write a new version">
                      <RefreshCw size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        navigator.clipboard.writeText(letter).then(
                          () => {
                            setCopied(true);
                            toast.success("Letter copied");
                            setTimeout(() => setCopied(false), 1500);
                          },
                          () => toast.error("Couldn't copy. Select the text and copy it instead."),
                        )
                      }
                    >
                      {copied ? <Check size={15} /> : <Copy size={15} />} Copy
                    </Button>
                    <Button variant="ghost" onClick={download}>
                      <Download size={15} /> .txt
                    </Button>
                    <Button variant="secondary" onClick={save}>
                      <Save size={15} /> {savedId ? "Saved" : "Save"}
                    </Button>
                  </>
                )}
              </div>
              {letter || generating ? (
                generating ? (
                  <div className="typing-caret flex-1 whitespace-pre-wrap font-display text-[17px] leading-relaxed">{letter}</div>
                ) : (
                  <textarea
                    value={letter}
                    onChange={(e) => {
                      setLetter(e.target.value);
                      setSavedId(null);
                    }}
                    className="field-sizing-content min-h-[28rem] flex-1 resize-none rounded border border-transparent p-1 font-display text-[17px] leading-relaxed outline-none focus:border-line"
                    aria-label="Your letter (editable)"
                  />
                )
              ) : (
                <div className="grid flex-1 place-items-center text-center text-slate-400">
                  <div className="max-w-xs">
                    <FileText size={44} className="mx-auto mb-3 text-gold-400" />
                    <p className="font-display text-xl text-ink">Your letter appears here</p>
                    <p className="mt-1 text-sm">It&apos;s written from the alignment map, so every point is backed by your resume. You can edit it here afterwards.</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {letters.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-semibold">Saved letters</h2>
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
                      setLetter(l.content);
                      setSavedId(l.id);
                      if (l.jobId && jobs.some((j) => j.id === l.jobId)) pickJob(l.jobId);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Open
                  </Button>
                  <Button
                    variant="danger"
                    aria-label="Delete letter"
                    onClick={() => {
                      setLetters((all) => all.filter((x) => x.id !== l.id));
                      toast("Letter deleted", { action: { label: "Undo", onClick: () => setLetters((all) => [l, ...all]) } });
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

function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500 font-display text-lg font-semibold text-gold-400 lining-nums">{n}</span>
      <div>
        <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
        {hint && <p className="text-sm text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
