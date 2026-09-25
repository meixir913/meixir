"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, FileText, Loader2, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { Button, Card, ChipToggle, Field, Input, PageHeader, Select, Textarea, readTextStream } from "@/components/ui";
import { LETTER_TONES, PHILOSOPHIES } from "@/lib/ece";
import type { JobContext } from "@/lib/prompts";
import { profileCompleteness, uid, useJobs, useLetters, useProfile } from "@/lib/storage";

const BLANK: JobContext = { title: "", centre: "", location: "", description: "", centreInfo: "", philosophies: [] };

export default function CoverLetterPage() {
  return (
    <Suspense>
      <CoverLetterStudio />
    </Suspense>
  );
}

function CoverLetterStudio() {
  const params = useSearchParams();
  const [profile, , profileLoaded] = useProfile();
  const [jobs, , jobsLoaded] = useJobs();
  const [letters, setLetters] = useLetters();

  const [jobId, setJobId] = useState<string>("");
  const [job, setJob] = useState<JobContext>(BLANK);
  const [tone, setTone] = useState(LETTER_TONES[0]);
  const [length, setLength] = useState<"short" | "standard">("standard");
  const [extra, setExtra] = useState("");

  const [letter, setLetter] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Preselect the job passed from the tracker (?job=id).
  useEffect(() => {
    const id = params.get("job");
    if (jobsLoaded && id && jobs.some((j) => j.id === id)) pickJob(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsLoaded]);

  function pickJob(id: string) {
    setJobId(id);
    const j = jobs.find((x) => x.id === id);
    setJob(j ? { title: j.title, centre: j.centre, location: j.location, description: j.description, centreInfo: j.centreInfo, philosophies: j.philosophies } : BLANK);
  }

  async function generate() {
    setGenerating(true);
    setError("");
    setLetter("");
    setSavedId(null);
    outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, job, tone, length, extra }),
      });
      await readTextStream(res, setLetter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  function save() {
    const id = savedId ?? uid();
    const entry = {
      id,
      jobId: jobId || null,
      title: job.title || "Cover letter",
      centre: job.centre,
      content: letter,
      createdAt: new Date().toISOString(),
    };
    setLetters((all) => [entry, ...all.filter((l) => l.id !== id)]);
    setSavedId(id);
  }

  function download() {
    const blob = new Blob([letter], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Cover letter - ${job.centre || job.title || "ECE"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const completeness = profileLoaded ? profileCompleteness(profile) : 100;
  const canGenerate = !generating && (job.description.trim() || job.centreInfo.trim());

  return (
    <>
      <PageHeader
        title="Cover Letter AI"
        subtitle="A letter written for this centre: its programs, its philosophy, and the job description, matched to your own experience."
      />

      {completeness < 60 && (
        <div className="mb-5 rounded-2xl bg-brand-50 p-4 text-sm text-brand-700">
          Your profile is {completeness}% complete. Letters are far more personal when we know your experience —{" "}
          <Link href="/profile" className="font-bold underline">
            fill in your profile
          </Link>
          .
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          {jobs.length > 0 && (
            <Field label="Use a job from your tracker">
              <Select
                value={jobId}
                onChange={pickJob}
                options={[{ value: "", label: "— Enter details manually —" }, ...jobs.map((j) => ({ value: j.id, label: `${j.title} · ${j.centre || "Unnamed centre"}` }))]}
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title">
              <Input value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} placeholder="Diploma Educator — Kindy room" />
            </Field>
            <Field label="Centre name">
              <Input value={job.centre} onChange={(e) => setJob({ ...job, centre: e.target.value })} placeholder="Wattle Grove Early Learning" />
            </Field>
          </div>
          <Field label="Job description">
            <Textarea rows={6} value={job.description} onChange={(e) => setJob({ ...job, description: e.target.value })} placeholder="Paste the job posting…" />
          </Field>
          <Field label="Centre's programs & philosophy" hint="from their website">
            <Textarea
              rows={5}
              value={job.centreInfo}
              onChange={(e) => setJob({ ...job, centreInfo: e.target.value })}
              placeholder="Paste their About us / Our philosophy / Programs page. The more specific, the better the letter."
            />
          </Field>
          <Field label="Pedagogical approach" group>
            <ChipToggle
              options={PHILOSOPHIES.map((p) => p.name)}
              titles={Object.fromEntries(PHILOSOPHIES.map((p) => [p.name, p.hint]))}
              selected={job.philosophies}
              onChange={(v) => setJob({ ...job, philosophies: v })}
            />
          </Field>
          <Field label="Anything you want to highlight?" hint="optional">
            <Textarea
              rows={3}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="e.g. I led our garden project with the preschoolers, I speak Tagalog, I'm available for full-time days…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tone">
              <Select value={tone} onChange={setTone} options={LETTER_TONES.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="Length">
              <Select
                value={length}
                onChange={(v) => setLength(v as "short" | "standard")}
                options={[
                  { value: "standard", label: "Standard (~350 words)" },
                  { value: "short", label: "Short (~220 words)" },
                ]}
              />
            </Field>
          </div>
          <Button onClick={generate} disabled={!canGenerate} className="w-full py-3">
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {generating ? "Writing your letter…" : letter ? "Write a new version" : "Generate cover letter"}
          </Button>
        </Card>

        <div ref={outputRef} className="scroll-mt-6">
          <Card className="flex min-h-[32rem] flex-col">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto font-extrabold">Your letter</h2>
              {letter && !generating && (
                <>
                  <Button variant="ghost" onClick={generate} title="Regenerate">
                    <RefreshCw size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(letter);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
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
            {error && <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            {letter || generating ? (
              generating ? (
                <div className="typing-caret flex-1 whitespace-pre-wrap font-serif text-[15px] leading-relaxed">{letter}</div>
              ) : (
                <textarea
                  value={letter}
                  onChange={(e) => {
                    setLetter(e.target.value);
                    setSavedId(null);
                  }}
                  className="field-sizing-content min-h-[26rem] flex-1 resize-none rounded-xl border border-transparent p-1 font-serif text-[15px] leading-relaxed outline-none focus:border-slate-200"
                  aria-label="Cover letter (editable)"
                />
              )
            ) : (
              <div className="grid flex-1 place-items-center text-center text-slate-400">
                <div>
                  <FileText size={44} className="mx-auto mb-3" />
                  <p>Your tailored letter will appear here.</p>
                  <p className="text-sm">You can edit it right here once it&apos;s written.</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {letters.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-extrabold">Saved letters</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {letters.map((l) => (
              <Card key={l.id} className="flex flex-col">
                <p className="font-bold">{l.title}</p>
                <p className="text-sm text-slate-500">
                  {l.centre || "—"} · {new Date(l.createdAt).toLocaleDateString()}
                </p>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-600">{l.content}</p>
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
                  <Button variant="danger" onClick={() => setLetters((all) => all.filter((x) => x.id !== l.id))} aria-label="Delete letter">
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
