"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, FileText, Newspaper, Video } from "lucide-react";
import { Logo } from "./AppShell";
import LanguageSwitcher from "./LanguageSwitcher";
import { Eyebrow } from "./ui";
import { Rich, useT } from "@/lib/i18n";

/** Two-panel layout for the sign-in pages: the form on cream, the brand story on navy. */
export default function AuthLayout({ heading, subtitle, children, footer }: { heading: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const t = useT();
  return (
    <div className="grid min-h-screen bg-cream lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/login">
            <Logo />
          </Link>
          <LanguageSwitcher className="w-36" />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Eyebrow className="mb-3">{t("Career dashboard")}</Eyebrow>
          <h1 className="text-4xl font-medium leading-tight text-ink md:text-5xl">
            <Rich text={heading} />
          </h1>
          {subtitle && <p className="mt-3 leading-relaxed text-body">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-body">{footer}</div>}
        </div>
      </div>

      <aside className="hidden flex-col justify-center bg-brand-500 px-12 py-16 text-white lg:flex">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">{t("For early childhood educators")}</p>
        <p className="mt-4 font-display text-4xl leading-tight">
          <Rich text="Your next centre is <em>already looking for you.</em>" />
        </p>
        <ul className="mt-10 space-y-6">
          {[
            { icon: Newspaper, title: "Job Vacancies every morning", body: "SEEK, Indeed, provider websites and community groups in one list, filtered by state and role." },
            { icon: FileText, title: "Cover letters matched to each centre", body: "Built from your resume and the centre's own philosophy, curriculum and programs." },
            { icon: Video, title: "Face-to-face Interview Prep", body: "Practise with an AI interviewer and get feedback on every answer." },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-gold-400">
                <Icon size={18} />
              </span>
              <span>
                <span className="block font-semibold">{t(title)}</span>
                <span className="mt-1 block text-sm leading-relaxed text-white/70">{t(body)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-12 flex items-center gap-2 text-sm text-white/60">
          <CheckCircle2 size={16} className="text-gold-400" /> {t("Free for job seekers. Your resume stays private to your account.")}
        </p>
      </aside>
    </div>
  );
}

/** Submits a JSON form to an auth endpoint and reports the error message, if any. */
export function useAuthForm<T>(url: string, onSuccess: (data: T) => void) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = (values: Record<string, string>) => async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong. Please try again.");
      onSuccess(data as T);
    } catch (err) {
      setError(t((err as Error).message));
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
      {message}
    </p>
  );
}

/** Only follow `next` links inside this site. */
export function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
