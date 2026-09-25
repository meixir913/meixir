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

/** "Continue with Google / Facebook", then an "or" divider before the email form. */
export function SocialLogin({ next }: { next: string }) {
  const t = useT();
  const q = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  const button = "flex w-full items-center justify-center gap-3 rounded border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand-200 hover:bg-cream focus-visible:outline-2 focus-visible:outline-gold-500";
  return (
    <div className="mb-6">
      <div className="grid gap-3">
        <a href={`/api/auth/oauth/google${q}`} className={button}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {t("Continue with Google")}
        </a>
        <a href={`/api/auth/oauth/facebook${q}`} className={button}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="12" fill="#1877F2" />
            <path fill="#fff" d="M13.4 19.5v-6.3h2.1l.3-2.5h-2.4V9.2c0-.7.2-1.2 1.2-1.2h1.3V5.8c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.8H8.7v2.5h2.1v6.3h2.6z" />
          </svg>
          {t("Continue with Facebook")}
        </a>
      </div>
      <p className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span className="h-px flex-1 bg-line" /> {t("or use your email")} <span className="h-px flex-1 bg-line" />
      </p>
    </div>
  );
}

export function FormNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="status" className="mb-6 flex items-start gap-2 rounded border border-leaf-100 bg-leaf-50 px-3 py-2.5 text-sm text-leaf-600">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {message}
    </p>
  );
}
