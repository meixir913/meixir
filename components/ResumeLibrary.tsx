"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, FileText, Pencil, Star, Trash2 } from "lucide-react";
import ResumeUpload from "./ResumeUpload";
import { Button, Input, Modal, Textarea } from "./ui";
import type { ResumeExtract } from "@/lib/letter-types";
import { useT } from "@/lib/i18n";
import type { Resume } from "@/lib/types";
import type { useResumeLibrary } from "@/lib/storage";

type Library = ReturnType<typeof useResumeLibrary>;

/** The resumes saved to My Profile: upload more, rename, edit the text, choose the default. */
export default function ResumeLibrary({ library, onUploaded }: { library: Library; onUploaded: (extract: ResumeExtract, resume: Resume) => void }) {
  const t = useT();
  const { resumes, defaultResume, add, update, remove, makeDefault } = library;
  const [editing, setEditing] = useState<Resume | null>(null);

  return (
    <div className="space-y-4">
      <ResumeUpload
        onParsed={(extract, fileName) => {
          const saved = add({ label: fileName.replace(/\.(pdf|docx|txt)$/i, ""), fileName, text: extract.resumeText });
          makeDefault(saved);
          onUploaded(extract, saved);
        }}
      />

      {resumes.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line">
          {resumes.map((r) => {
            const isDefault = r.id === defaultResume?.id;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <FileText size={18} className="shrink-0 text-gold-600" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    <span className="truncate">{r.label}</span>
                    {isDefault && <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-700">{t("Default")}</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t("Uploaded {date}", { date: new Date(r.uploadedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) })} · {t("{n} words", { n: r.text.split(/\s+/).filter(Boolean).length })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!isDefault && (
                    <Button variant="ghost" className="!px-2.5 !py-1.5 text-xs" onClick={() => makeDefault(r)}>
                      <Star size={14} /> {t("Make default")}
                    </Button>
                  )}
                  <Button variant="ghost" className="!px-2.5 !py-1.5" onClick={() => setEditing(r)} aria-label={t("Edit")} title={t("Edit")}>
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-2.5 !py-1.5"
                    aria-label={t("Delete")}
                    title={t("Delete")}
                    onClick={() => {
                      remove(r.id);
                      toast(t("Resume deleted"));
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {resumes.length > 1 && <p className="text-xs text-slate-500">{t("Keep a version for each kind of role. You choose which one to use each time you write a cover letter.")}</p>}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("Edit resume")}>
        {editing && <ResumeEditor resume={editing} onSave={(patch) => { update(editing.id, patch); setEditing(null); toast.success(t("Resume saved")); }} />}
      </Modal>
    </div>
  );
}

function ResumeEditor({ resume, onSave }: { resume: Resume; onSave: (patch: { label: string; text: string }) => void }) {
  const t = useT();
  const [label, setLabel] = useState(resume.label);
  const [text, setText] = useState(resume.text);
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-ink">{t("Name")}</span>
        <Input className="mt-1.5" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-ink">{t("Resume text")}</span>
        <span className="ml-2 text-xs text-slate-500">{t("what letters are written from; edit freely")}</span>
        <Textarea className="mt-1.5" rows={16} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="flex justify-end">
        <Button onClick={() => onSave({ label: label.trim() || resume.label, text })}>
          <Check size={16} /> {t("Save")}
        </Button>
      </div>
    </div>
  );
}
