"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookmarkCheck, BookmarkPlus, Building2, ExternalLink, FileText, Loader2, Mail, MapPin, Megaphone, Newspaper, Radio, Search, Users } from "lucide-react";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import type { FeedJob, SourceKind, SourceRun } from "@/lib/feed/types";
import { uid, useJobs } from "@/lib/storage";

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

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function JobFeedPage() {
  const router = useRouter();
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [error, setError] = useState("");
  const [tracked, setTracked] = useJobs();

  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [level, setLevel] = useState("");
  const [kind, setKind] = useState<SourceKind | "all">("all");
  const [days, setDays] = useState("7");

  const load = () =>
    fetch("/api/feed")
      .then((r) => r.json())
      .then(setFeed)
      .catch(() => setError("Couldn't load the job feed. Refresh to try again."));

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
        (kind === "all" || j.sourceKind === kind) &&
        new Date(j.postedAt || j.collectedAt).getTime() >= cutoff,
    );
  }, [feed, query, state, level, kind, days]);

  const newToday = feed && !feed.sample ? feed.jobs.filter((j) => isToday(j.collectedAt)).length : 0;
  const trackedId = (j: FeedJob) => tracked.find((t) => (j.url && t.url === j.url) || (t.title === j.title && t.centre === j.employer))?.id;

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
        status: "saved",
        notes: `Found via ${j.source}`,
        interviewDate: "",
        createdAt: now,
        updatedAt: now,
      },
      ...all,
    ]);
    return id;
  }

  return (
    <>
      <PageHeader
        eyebrow="Updated every morning"
        title="ECE Job"
        accent="Feed"
        subtitle="New early childhood jobs collected every morning from job boards, provider career sites, SEEK and Indeed alerts, and Facebook groups."
      />

      {error && <p className="mb-4 rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {feed?.sample && (
        <div className="mb-5 rounded-md bg-gold-50 p-4 text-sm text-gold-700">
          These are <b>sample jobs</b>. No channels are connected yet. Add job board keys, provider feeds or an alert inbox (see the README) and real jobs will appear here after the next morning run.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, centre or suburb" className="pl-9" aria-label="Search jobs" />
            </div>
            <Select value={state} onChange={setState} options={[{ value: "", label: "All states" }, ...STATES.map((s) => ({ value: s, label: s }))]} />
            <Select value={level} onChange={setLevel} options={[{ value: "", label: "All roles" }, ...LEVELS.map((l) => ({ value: l, label: l }))]} />
            <Select
              value={days}
              onChange={setDays}
              options={[
                { value: "1", label: "Posted today" },
                { value: "3", label: "Last 3 days" },
                { value: "7", label: "Last 7 days" },
                { value: "all", label: "Last 30 days" },
              ]}
            />
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKind(k.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    kind === k.id ? "border-gold-500 bg-gold-50 text-gold-700" : "border-line bg-white text-body hover:border-brand-200"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </Card>

          <p className="text-sm text-body">
            {feed ? (
              <>
                <b>{visible.length}</b> jobs shown · <b>{newToday}</b> new today
                {feed.lastCollectedAt && <> · last collected {new Date(feed.lastCollectedAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</>}
              </>
            ) : (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading jobs…
              </span>
            )}
          </p>

          {feed && visible.length === 0 ? (
            <EmptyState icon={<Newspaper size={40} />} title="No jobs match these filters">
              Try another state or role, or widen the date range.
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
                          {isToday(j.collectedAt) && !feed?.sample && <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold text-brand-500">NEW</span>}
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
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-body">{j.roleLevel}</span>
                          {j.salary && <span className="font-bold text-slate-700">{j.salary}</span>}
                          {j.employmentType && <span className="capitalize text-slate-500">{j.employmentType}</span>}
                          <span className={`rounded-full px-2 py-0.5 font-bold ${KIND_STYLE[j.sourceKind]}`}>{j.source}</span>
                          <span className="text-slate-400">posted {ago(j.postedAt || j.collectedAt)}</span>
                        </div>
                        {j.description && <p className="mt-2 line-clamp-2 text-sm text-body">{j.description}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {j.url && (
                          <a href={j.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-50">
                            <ExternalLink size={14} /> View ad
                          </a>
                        )}
                        <Button variant={savedId ? "secondary" : "primary"} onClick={() => save(j)} disabled={Boolean(savedId)}>
                          {savedId ? <BookmarkCheck size={15} /> : <BookmarkPlus size={15} />}
                          {savedId ? "In tracker" : "Save"}
                        </Button>
                        <Button variant="ghost" onClick={() => router.push(`/cover-letter?job=${save(j)}`)} title="Save and write a cover letter">
                          <FileText size={15} /> Cover letter
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
        text: added ? `Added ${added} job${added > 1 ? "s" : ""} to the feed.` : data.found ? "That job is already in the feed." : "No early childhood job found in that post.",
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
        <Megaphone size={18} className="text-gold-500" /> Share a job post
      </h2>
      <p className="text-sm text-body">Seen a job in a Facebook group? Paste the post and AI adds it to the feed for everyone.</p>
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the post text, including any link or contact details" aria-label="Job post text" />
      <Field label="Where was it posted?">
        <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="e.g. Sydney ECE Jobs (Facebook group)" />
      </Field>
      {needsKey && (
        <Field label="Team key">
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} />
        </Field>
      )}
      <Button onClick={submit} disabled={busy || !text.trim()} className="w-full">
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Add to feed
      </Button>
      {message && <p className={`text-sm ${message.ok ? "text-leaf-600" : "text-rose-600"}`}>{message.text}</p>}
    </Card>
  );
}

function Channels({ feed }: { feed: FeedResponse }) {
  const c = feed.channels;
  const connected = c.providers.filter((p) => p.connected).length;
  const runFor = (name: string) => feed.runs.find((r) => r.source === name);
  const rows = [
    { icon: <Radio size={16} />, label: "Job boards (Adzuna)", on: c.jobBoards.adzuna, run: runFor("Adzuna") },
    { icon: <Radio size={16} />, label: "Job boards (Jooble)", on: c.jobBoards.jooble, run: runFor("Jooble") },
    { icon: <Building2 size={16} />, label: `Provider career sites (${connected} of ${c.providers.length})`, on: connected > 0 },
    { icon: <Mail size={16} />, label: "SEEK / Indeed alert inbox", on: c.emailAlerts },
    { icon: <Users size={16} />, label: "Facebook groups (shared posts)", on: true },
  ];
  return (
    <Card className="space-y-3">
      <h2 className="text-2xl font-semibold">Channels</h2>
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
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.on ? "bg-leaf-50 text-leaf-600" : "bg-slate-100 text-slate-500"}`}>{r.on ? "On" : "Off"}</span>
          </li>
        ))}
      </ul>
      {connected < c.providers.length && (
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-body">Providers not connected yet</summary>
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
        Collected daily at 6am AEST. Setup steps are in the{" "}
        <Link href="https://github.com/meixir913/meixir#job-feed" className="underline" target="_blank">
          README
        </Link>
        .
      </p>
    </Card>
  );
}
