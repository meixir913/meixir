"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Briefcase, CalendarClock, FileText, Newspaper, Send, Trophy, UserRound, Video } from "lucide-react";
import RobotAvatar from "@/components/RobotAvatar";
import { Card, Eyebrow } from "@/components/ui";
import { STATUSES } from "@/lib/ece";
import type { FeedJob } from "@/lib/feed/types";
import { profileCompleteness, useInterviews, useJobs, useLetters, useProfile } from "@/lib/storage";

export default function Dashboard() {
  const [profile] = useProfile();
  const [jobs] = useJobs();
  const [letters] = useLetters();
  const [interviews] = useInterviews();
  const [feed, setFeed] = useState<{ jobs: FeedJob[]; sample: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/feed")
      .then((r) => r.json())
      .then(setFeed)
      .catch(() => {});
  }, []);
  const today = new Date().toDateString();
  const newJobs = feed && !feed.sample ? feed.jobs.filter((j) => new Date(j.collectedAt).toDateString() === today) : [];

  const count = (s: string) => jobs.filter((j) => j.status === s).length;
  const applied = jobs.filter((j) => j.status !== "saved").length;
  const scored = interviews.filter((i) => i.feedback);
  const avgScore = scored.length ? Math.round(scored.reduce((a, i) => a + (i.feedback?.overallScore ?? 0), 0) / scored.length) : null;
  const upcoming = jobs
    .filter((j) => j.interviewDate && new Date(j.interviewDate).getTime() > Date.now() - 3600_000)
    .sort((a, b) => a.interviewDate.localeCompare(b.interviewDate))
    .slice(0, 4);
  const pct = profileCompleteness(profile);
  const firstName = profile.name.split(" ")[0];

  const stats = [
    { label: "Jobs tracked", value: jobs.length, icon: Briefcase },
    { label: "Applications sent", value: applied, icon: Send },
    { label: "Cover letters", value: letters.length, icon: FileText },
    { label: "Avg. interview score", value: avgScore ?? "—", icon: Trophy },
  ];

  return (
    <>
      <section className="mb-8 grid overflow-hidden rounded-md border border-line bg-white lg:grid-cols-[1fr_300px]">
        <div className="p-6 md:p-10">
          <Eyebrow>Early childhood career dashboard · Australia</Eyebrow>
          <h1 className="mt-4 text-4xl font-medium leading-[1.05] text-ink md:text-6xl">
            {firstName ? (
              <>
                Welcome back, <em className="text-gold-500">{firstName}</em>
              </>
            ) : (
              <>
                Land your next <em className="text-gold-500">ECE role</em>
              </>
            )}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-body">
            Find new ECE jobs every morning, track your applications, write cover letters in each centre&apos;s own language, and rehearse interviews face to face with Robin, your AI interviewer.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/job-feed" className="inline-flex items-center gap-2 rounded bg-brand-500 px-6 py-3.5 text-sm font-semibold tracking-wide text-white hover:bg-brand-600">
              <Newspaper size={16} /> Browse today&apos;s jobs
            </Link>
            <Link href="/cover-letter" className="inline-flex items-center gap-1.5 border-b border-ink pb-0.5 text-sm font-semibold text-ink hover:border-gold-500 hover:text-gold-700">
              Write a cover letter <ArrowRight size={14} />
            </Link>
            <Link href="/interview" className="inline-flex items-center gap-1.5 border-b border-ink pb-0.5 text-sm font-semibold text-ink hover:border-gold-500 hover:text-gold-700">
              Practise an interview <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <div className="hidden flex-col items-center justify-center gap-2 bg-brand-500 p-6 lg:flex">
          <RobotAvatar state="idle" size={200} />
          <p className="text-center font-display text-lg italic text-white/90">&ldquo;Ready when you are.&rdquo;</p>
          <p className="text-xs uppercase tracking-[0.16em] text-gold-400">Robin · AI interviewer</p>
        </div>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <Icon size={20} className="text-gold-500" />
            <p className="mt-3 font-display text-5xl font-semibold leading-none lining-nums">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Application pipeline</h2>
            <Link href="/jobs" className="flex items-center gap-1 text-sm font-bold text-brand-600">
              Open tracker <ArrowRight size={14} />
            </Link>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500">
              No jobs yet.{" "}
              <Link href="/jobs" className="font-bold text-brand-600 underline">
                Add a posting
              </Link>{" "}
              to start tracking.
            </p>
          ) : (
            <>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                {STATUSES.map((s) => {
                  const n = count(s.id);
                  return n ? <div key={s.id} className={s.color} style={{ width: `${(n / jobs.length) * 100}%` }} title={`${s.label}: ${n}`} /> : null;
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {STATUSES.map((s) => (
                  <div key={s.id} className="rounded bg-slate-50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <span className={`h-2 w-2 rounded-full ${s.color}`} />
                      {s.label}
                    </p>
                    <p className="mt-1 font-display text-4xl font-semibold leading-none lining-nums">{count(s.id)}</p>
                  </div>
                ))}
              </div>
              <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-body">Recently updated</h3>
              <ul className="divide-y divide-slate-100">
                {[...jobs]
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .slice(0, 5)
                  .map((j) => (
                    <li key={j.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUSES.find((s) => s.id === j.status)?.color}`} />
                      <span className="min-w-0 flex-1 truncate">
                        <b>{j.title}</b> <span className="text-slate-500">· {j.centre || "—"}</span>
                      </span>
                      <Link href={`/cover-letter?job=${j.id}`} className="text-slate-400 hover:text-brand-600" title="Cover letter">
                        <FileText size={16} />
                      </Link>
                      <Link href={`/interview?job=${j.id}`} className="text-slate-400 hover:text-brand-600" title="Practise interview">
                        <Video size={16} />
                      </Link>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-2xl font-semibold">
              <Newspaper size={18} className="text-gold-500" /> New ECE jobs today
            </h2>
            {feed === null ? (
              <p className="text-sm text-slate-500">Checking the feed…</p>
            ) : newJobs.length === 0 ? (
              <p className="text-sm text-slate-500">No new jobs collected yet today. Browse the last 30 days in the job feed.</p>
            ) : (
              <>
                <p className="font-display text-5xl font-semibold leading-none lining-nums">{newJobs.length}</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {newJobs.slice(0, 3).map((j) => (
                    <li key={j.id} className="truncate">
                      <b>{j.title}</b> <span className="text-slate-500">· {j.location || j.employer}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Link href="/job-feed" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-600">
              Open job feed <ArrowRight size={13} />
            </Link>
          </Card>

          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-2xl font-semibold">
              <CalendarClock size={18} className="text-gold-500" /> Upcoming interviews
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">Add an interview date to a job and it will show up here.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((j) => (
                  <li key={j.id} className="rounded bg-gold-50 p-3 text-sm">
                    <p className="font-bold">{j.centre || j.title}</p>
                    <p className="text-body">
                      {new Date(j.interviewDate).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                    <Link href={`/interview?job=${j.id}`} className="mt-1 inline-flex items-center gap-1 font-bold text-brand-600">
                      Rehearse with Robin <ArrowRight size={13} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-2xl font-semibold">
              <UserRound size={18} className="text-leaf-500" /> Profile strength
            </h2>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-body">
              {pct}% complete.{" "}
              {pct < 100 && (
                <Link href="/profile" className="font-bold text-brand-600">
                  Finish your profile
                </Link>
              )}
            </p>
          </Card>

          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-2xl font-semibold">
              <Trophy size={18} className="text-gold-500" /> Interview practice
            </h2>
            {scored.length === 0 ? (
              <p className="text-sm text-slate-500">Complete a mock interview to see your scores here.</p>
            ) : (
              <div className="flex h-20 items-end gap-1.5">
                {scored
                  .slice(0, 10)
                  .reverse()
                  .map((s) => (
                    <div
                      key={s.id}
                      className="max-w-10 flex-1 rounded-t-sm bg-gold-500"
                      style={{ height: `${s.feedback!.overallScore}%` }}
                      title={`${s.feedback!.overallScore} · ${new Date(s.createdAt).toLocaleDateString()}`}
                    />
                  ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
