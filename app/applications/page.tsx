"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, CalendarClock, ExternalLink, FileText, MapPin, Pencil, Plus, Search, Trash2, Video } from "lucide-react";
import JobForm, { EMPTY_JOB, type JobDraft } from "@/components/JobForm";
import { Button, EmptyState, Input, Modal, PageHeader } from "@/components/ui";
import { STATUSES } from "@/lib/ece";
import { uid, useJobs } from "@/lib/storage";
import type { Job, JobStatus } from "@/lib/types";

export default function JobsPage() {
  const [jobs, setJobs] = useJobs();
  const [editing, setEditing] = useState<Job | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<JobStatus | null>(null);

  const visible = jobs.filter((j) =>
    `${j.title} ${j.centre} ${j.location}`.toLowerCase().includes(query.toLowerCase()),
  );

  function save(draft: JobDraft) {
    const now = new Date().toISOString();
    if (editing === "new") {
      setJobs((all) => [{ ...draft, id: uid(), createdAt: now, updatedAt: now }, ...all]);
    } else if (editing) {
      setJobs((all) => all.map((j) => (j.id === editing.id ? { ...j, ...draft, updatedAt: now } : j)));
    }
    toast.success(editing === "new" ? "Job added to Applications" : "Job updated");
    setEditing(null);
  }

  function move(id: string, status: JobStatus) {
    setJobs((all) => all.map((j) => (j.id === id ? { ...j, status, updatedAt: new Date().toISOString() } : j)));
  }

  function remove(id: string) {
    const removed = jobs.find((j) => j.id === id);
    if (!removed) return;
    setJobs((all) => all.filter((j) => j.id !== id));
    toast("Job removed", {
      description: [removed.title, removed.centre].filter(Boolean).join(" · "),
      action: { label: "Undo", onClick: () => setJobs((all) => [removed, ...all]) },
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Your job search"
        title="Your"
        accent="applications"
        subtitle="Track every job you're going for. Save jobs from Vacancies or add your own, then drag cards between stages as you hear back."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} /> Add job
          </Button>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState icon={<Briefcase size={40} />} title="No jobs tracked yet">
          Add a posting you&apos;re interested in. Paste the description and we&apos;ll pull out the centre, pay and philosophy for you.
          <div className="mt-4">
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} /> Add your first job
            </Button>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs" className="pl-9" />
          </div>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
            {STATUSES.map((col) => {
              const items = visible.filter((j) => j.status === col.id);
              return (
                <section
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverCol(col.id);
                  }}
                  onDragLeave={() => setOverCol(null)}
                  onDrop={() => {
                    if (dragId) move(dragId, col.id);
                    setDragId(null);
                    setOverCol(null);
                  }}
                  className={`flex w-72 shrink-0 flex-col rounded-md p-3 transition ${overCol === col.id ? "bg-brand-100/60" : "bg-slate-100/70"}`}
                >
                  <h2 className="mb-3 flex items-center gap-2 px-1 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-ink">
                    <span className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                    {col.label}
                    <span className="ml-auto rounded-full bg-white px-2 text-xs text-slate-500">{items.length}</span>
                  </h2>
                  <div className="flex min-h-24 flex-col gap-3">
                    {items.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onDragStart={() => setDragId(job.id)}
                        onEdit={() => setEditing(job)}
                        onDelete={() => remove(job.id)}
                        onMove={(s) => move(job.id, s)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add a job" : "Edit job"}>
        {editing !== null && (
          <JobForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? EMPTY_JOB : editing}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}

function JobCard({
  job,
  onDragStart,
  onEdit,
  onDelete,
  onMove,
}: {
  job: Job;
  onDragStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (s: JobStatus) => void;
}) {
  return (
    <article draggable onDragStart={onDragStart} className="cursor-grab rounded border border-white bg-white p-3.5 shadow-sm active:cursor-grabbing">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{job.title || "Untitled role"}</h3>
          <p className="truncate text-sm text-body">{job.centre || "Centre not set"}</p>
        </div>
        {job.url && (
          <a href={job.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-gold-500" aria-label="Open posting">
            <ExternalLink size={15} />
          </a>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        {job.location && (
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {job.location}
          </span>
        )}
        {job.salary && <span>{job.salary}</span>}
        {job.interviewDate && (
          <span className="flex items-center gap-1 font-bold text-gold-700">
            <CalendarClock size={12} />
            {new Date(job.interviewDate).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>
      {job.philosophies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {job.philosophies.slice(0, 3).map((p) => (
            <span key={p} className="rounded-full bg-leaf-50 px-2 py-0.5 text-[11px] font-bold text-leaf-600">
              {p}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2">
        <Link href={`/letters?job=${job.id}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-600" title="Write cover letter">
          <FileText size={15} />
        </Link>
        <Link href={`/interview?job=${job.id}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-600" title="Practise interview">
          <Video size={15} />
        </Link>
        <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Edit">
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Delete">
          <Trash2 size={15} />
        </button>
        <select
          value={job.status}
          onChange={(e) => onMove(e.target.value as JobStatus)}
          className="ml-auto rounded-lg border-0 bg-slate-50 py-1 text-xs font-bold text-body"
          aria-label="Move to stage"
        >
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}
