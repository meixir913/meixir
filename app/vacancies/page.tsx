"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookmarkCheck, BookmarkPlus, Building2, ExternalLink, FileText, Loader2, Mail, MapPin, Megaphone, Newspaper, Radio, Search, Users } from "lucide-react";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Skeleton, Textarea } from "@/components/ui";
import type { FeedJob, SourceKind, SourceRun } from "@/lib/feed/types";
import JobAlerts from "@/components/JobAlerts";
import { jobMatches } from "@/lib/alerts/match";
import { EMPLOYMENT_TYPES, employmentKind } from "@/lib/jobtypes";
import { uid, useJobs, useProfile } from "@/lib/storage";
import { Rich, useT, type Translate } from "@/lib/i18n";

interface FeedResponse {
  jobs: FeedJob[];
  sample: boolean;
  lastCollectedAt: string | null;
  runs: SourceRun[];
  channels: {
    jobBoards: { adzuna: boolean; jooble: boolean };
    providers: { name: string; website: string; connected: boolean }[];
    emailAlerts: boolean;
    submitNeedsKey: boolean;
    centreScanner: boolean;
  };
}

const KINDS: { id: SourceKind | "all"; label: string }[] = [
  { id: "all", label: "All channels" },
  { id: "job-board", label: "Job boards" },
  { id: "provider", label: "Provider career sites" },
  { id: "email-alert", label: "SEEK / Indeed alerts" },
  { id: "community", label: "Facebook groups & shared" },
];

const KIND_STYLE: Record<SourceKind, string> = {
  "job-board": "bg-brand-50 text-brand-600",
  provider: "bg-leaf-50 text-leaf-600",
  "email-alert": "bg-gold-50 text-gold-700",
  community: "bg-violet-50 text-violet-700",
};

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const LEVELS = ["Educator (Cert III)", "Diploma Educator", "Early Childhood Teacher", "Room / Educational Leader", "Centre Director", "OSHC", "Cook", "Educator"];

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function ago(iso: string, t: Translate) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return t("posted today");
  if (days === 1) return t("posted yesterday");
  return t("posted {n} days ago", { n: days });
}

export default function VacanciesPage() {
  return (
    <Suspense>
      <Vacancies />
    </Suspense>
  );
}

function Vacancies() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [error, setError] = useState("");
  const [tracked, setTracked] = useJobs();

  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [level, setLevel] = useState("");
  const [employment, setEmployment] = useState("");
  const [kind, setKind] = useState<SourceKind | "all">("all");
  const [days, setDays] = useState(params.get("new") ? "1" : "7");
  const [mine, setMine] = useState(false);
  const [profile] = useProfile();
  const hasPrefs = profile.preferredStates.length + profile.preferredRoles.length + profile.preferredEmployment.length > 0;

  useEffect(() => {
    const a = params.get("alerts");
    if (a === "confirmed") toast.success(t("Job alerts confirmed"), { description: t("You'll get an email each morning when new jobs match.") });
    if (a === "invalid") toast.error(t("That confirmation link has expired. Set up your alerts again."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = () =>
    fetch("/api/feed")
      .then((r) => r.json())
      .then(setFeed)
      .catch(() => setError("Couldn't load vacancies. Refresh to try again."));

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (!feed) return [];
    const q = query.toLowerCase();
    const cutoff = days === "all" ? 0 : Date.now() - Number(days) * 864e5;
    return feed.jobs.filter(
      (j) =>
        (!q || `${j.title} ${j.employer} ${j.location}`.toLowerCase().includes(q)) &&
        (!state || j.state === state) &&
        (!level || j.roleLevel === level) &&
        (!employment || employmentKind(j.employmentType, j.title, j.description) === employment) &&
        (!mine || jobMatches(j, { states: profile.preferredStates, roleTypes: profile.preferredRoles, employment: profile.preferredEmployment, keywords: "" })) &&
        (kind === "all" || j.sourceKind === kind) &&
        new Date(j.postedAt || j.collectedAt).getTime() >= cutoff,
    );
  }, [feed, query, state, level, employment, mine, profile, kind, days]);

  const newToday = feed && !feed.sample ? feed.jobs.filter((j) => isToday(j.collectedAt)).length : 0;
  const trackedId = (j: FeedJob) => tracked.find((x) => (j.url && x.url === j.url) || (x.title === j.title && x.centre === j.employer))?.id;

  function save(j: FeedJob): string {
    const existing = trackedId(j);
    if (existing) return existing;
    const now = new Date().toISOString();
    const id = uid();
    setTracked((all) => [
      {
        id,
        title: j.title,
        centre: j.employer,
        location: j.location,
        salary: j.salary,
        url: j.url,
        description: j.description,
        centreInfo: "",
        philosophies: [],
        state: j.state ?? "",
        roleType: j.roleLevel,
        employmentType: employmentKind(j.employmentType, j.title),
        centreCurriculum: "",
        centrePhilosophy: "",
        centrePrograms: "",
        website: "",
        status: "saved",
        notes: `Found via ${j.source}`,
        interviewDate: "",
        createdAt: now,
        updatedAt: now,
      },
      ...all,
    ]);
    toast.success(t("Saved to Applications"), { action: { label: "Open", onClick: () => router.push("/applications") } });
    return id;
  }

  return (
    <>
      <PageHeader
        eyebrow={t("Updated every morning")}
        heading="Early childhood job <em>vacancies</em>"
        subtitle={t("New roles gathered every morning from job boards, centre and provider career pages, SEEK and Indeed alerts, and Facebook groups. Filter by state and job type, and get alerted when a match appears.")}
        action={<JobAlerts />}
      />

      {error && <p className="mb-4 rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {feed?.sample && (
        <div className="mb-5 rounded-md bg-gold-50 p-4 text-sm text-gold-700">
          <Rich text="These are <b>sample jobs</b>. No channels are connected yet. Once job boards, provider feeds or an alert inbox are connected, real jobs appear here after the next morning run." />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-4">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search title, centre or suburb")} className="pl-9" aria-label={t("Search jobs")} />
            </div>
            <Select value={state} onChange={setState} options={[{ value: "", label: t("All states") }, ...STATES.map((s) => ({ value: s, label: s }))]} />
            <Select value={level} onChange={setLevel} options={[{ value: "", label: t("All job types") }, ...LEVELS.map((l) => ({ value: l, label: t(l) }))]} />
            <Select value={employment} onChange={setEmployment} options={[{ value: "", label: t("Any employment") }, ...EMPLOYMENT_TYPES.map((e) => ({ value: e, label: t(e) }))]} />
            <Select
              value={days}
              onChange={setDays}
              options={[
                { value: "1", label: t("Posted today") },
                { value: "3", label: t("Last 3 days") },
                { value: "7", label: t("Last 7 days") },
                { value: "all", label: t("Last 30 days") },
              ]}
            />
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              {hasPrefs && (
                <button
                  onClick={() => setMine((m) => !m)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${mine ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-white text-ink hover:border-brand-500"}`}
                  title={t("States, job types and employment from My Profile")}
                >
                  {t("Matches my preferences")}
                </button>
              )}
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKind(k.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    kind === k.id ? "border-gold-500 bg-gold-50 text-gold-700" : "border-line bg-white text-body hover:border-brand-200"
                  }`}
                >
                  {t(k.label)}
                </button>
              ))}
            </div>
          </Card>

          <p className="text-sm text-body">
            {feed ? (
              <>
                <Rich text="<b>{n}</b> jobs shown · <b>{m}</b> new today" vars={{ n: visible.length, m: newToday }} />
                {feed.lastCollectedAt && <> · {t("last collected {when}", { when: new Date(feed.lastCollectedAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) })}</>}
              </>
            ) : (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> {t("Loading jobs…")}
              </span>
            )}
          </p>

          {!feed && !error ? (
            <div className="space-y-3" aria-label={t("Loading jobs")}>
              {[0, 1, 2].map((i) => (
                <Card key={i} className="space-y-3 p-4">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                </Card>
              ))}
            </div>
          ) : feed && visible.length === 0 ? (
            <EmptyState icon={<Newspaper size={40} />} title={t("No jobs match these filters")}>
              {t("Try another state or role, or widen the date range.")}
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {visible.map((j) => {
                const savedId = trackedId(j);
                return (
                  <Card key={j.id} className="p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1 basis-[26rem]">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{j.title}</h3>
                          {isToday(j.collectedAt) && !feed?.sample && <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold text-brand-500">{t("NEW")}</span>}
                        </div>
                        <p className="text-sm text-body">
                          {j.employer || "Employer not listed"}
                          {j.location && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <MapPin size={12} /> {j.location}
                            </span>
                          )}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-body">{t(j.roleLevel)}</span>
                          {j.salary && <span className="font-bold text-slate-700">{j.salary}</span>}
                          {j.employmentType && <span className="capitalize text-slate-500">{j.employmentType}</span>}
                          <span className={`rounded-full px-2 py-0.5 font-bold ${KIND_STYLE[j.sourceKind]}`}>{j.source}</span>
                          <span className="text-slate-400">{ago(j.postedAt || j.collectedAt, t)}</span>
                        </div>
                        {j.description && <p className="mt-2 line-clamp-2 text-sm text-body">{j.description}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {j.url && (
                          <a href={j.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-50">
                            <ExternalLink size={14} /> {t("View ad")}
                          </a>
                        )}
                        <Button variant={savedId ? "secondary" : "primary"} onClick={() => save(j)} disabled={Boolean(savedId)}>
                          {savedId ? <BookmarkCheck size={15} /> : <BookmarkPlus size={15} />}
                          {savedId ? t("In tracker") : t("Save")}
                        </Button>
                        <Button variant="ghost" onClick={() => router.push(`/letters?job=${save(j)}`)} title={t("Save and write a cover letter")}>
                          <FileText size={15} /> {t("Cover letter")}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <ShareJobPost needsKey={feed?.channels.submitNeedsKey ?? false} onAdded={load} />
          {feed && <Channels feed={feed} />}
        </aside>
      </div>
    </>
  );
}

function ShareJobPost({ needsKey, onAdded }: { needsKey: boolean; onAdded: () => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("Facebook group");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/feed/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, channel, key }),
      });
      const data = (await res.json()) as { error?: string; found?: number; added?: FeedJob[] };
      if (data.error) throw new Error(data.error);
      const added = data.added?.length ?? 0;
      setMessage({
        ok: added > 0,
        text: added ? t(added > 1 ? "Added {n} jobs to the feed." : "Added {n} job to the feed.", { n: added }) : data.found ? t("That job is already in the feed.") : t("No early childhood job found in that post."),
      });
      if (added) {
        setText("");
        onAdded();
      }
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Couldn't add that post." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <Megaphone size={18} className="text-gold-500" /> {t("Share a job post")}
      </h2>
      <p className="text-sm text-body">{t("Seen a job in a Facebook group? Paste the post and AI adds it to the feed for everyone.")}</p>
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Paste the post text, including any link or contact details")} aria-label={t("Job post text")} />
      <Field label={t("Where was it posted?")}>
        <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder={t("e.g. Sydney ECE Jobs (Facebook group)")} />
      </Field>
      {needsKey && (
        <Field label={t("Team key")}>
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} />
        </Field>
      )}
      <Button onClick={submit} disabled={busy || !text.trim()} className="w-full">
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} {t("Add to feed")}
      </Button>
      {message && <p className={`text-sm ${message.ok ? "text-leaf-600" : "text-rose-600"}`}>{message.text}</p>}
    </Card>
  );
}

function Channels({ feed }: { feed: FeedResponse }) {
  const t = useT();
  const c = feed.channels;
  const connected = c.providers.filter((p) => p.connected).length;
  const runFor = (name: string) => feed.runs.find((r) => r.source === name);
  const rows = [
    { icon: <Radio size={16} />, label: t("Job boards (Adzuna)"), on: c.jobBoards.adzuna, run: runFor("Adzuna") },
    { icon: <Radio size={16} />, label: t("Job boards (Jooble)"), on: c.jobBoards.jooble, run: runFor("Jooble") },
    { icon: <Building2 size={16} />, label: t("Provider career sites ({n} of {total})", { n: connected, total: c.providers.length }), on: connected > 0 },
    { icon: <Mail size={16} />, label: t("SEEK / Indeed alert inbox"), on: c.emailAlerts },
    { icon: <Users size={16} />, label: t("Facebook groups (shared posts)"), on: true },
    { icon: <Building2 size={16} />, label: t("Centre websites (ACECQA register)"), on: c.centreScanner },
  ];
  return (
    <Card className="space-y-3">
      <h2 className="text-2xl font-semibold">{t("Channels")}</h2>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-2">
            <span className={r.on ? "text-leaf-600" : "text-slate-300"}>{r.icon}</span>
            <span className="flex-1">
              {r.label}
              {r.run && (
                <span className={`block text-xs ${r.run.ok ? "text-slate-500" : "text-rose-600"}`}>
                  {r.run.ok ? `${r.run.added} new of ${r.run.found} found` : r.run.error}
                </span>
              )}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.on ? "bg-leaf-50 text-leaf-600" : "bg-slate-100 text-slate-500"}`}>{r.on ? t("On") : t("Off")}</span>
          </li>
        ))}
      </ul>
      {connected < c.providers.length && (
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-body">{t("Providers not connected yet")}</summary>
          <ul className="mt-2 space-y-1 text-slate-500">
            {c.providers
              .filter((p) => !p.connected)
              .map((p) => (
                <li key={p.name}>{p.name}</li>
              ))}
          </ul>
        </details>
      )}
      <p className="text-xs text-slate-500">
        {t("Collected daily at 6am AEST.")}{" "}
        <Link href="https://github.com/meixir913/meixir/blob/main/DEPLOY.md" className="underline" target="_blank">
          {t("Setup guide")}
        </Link>
      </p>
    </Card>
  );
}
