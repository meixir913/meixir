"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import LanguageSwitcher from "./LanguageSwitcher";
import { Briefcase, Building2, FileText, LayoutDashboard, Newspaper, Sparkles, UserRound, Video } from "lucide-react";
import { Rich, useT } from "@/lib/i18n";

const NAV = [
  { href: "/", label: "Overview", short: "Overview", icon: LayoutDashboard },
  { href: "/vacancies", label: "Vacancies", short: "Vacancies", icon: Newspaper },
  { href: "/centres", label: "Centres Hiring", short: "Centres", icon: Building2 },
  { href: "/applications", label: "Applications", short: "Applied", icon: Briefcase },
  { href: "/letters", label: "Cover Letter", short: "Letter", icon: FileText },
  { href: "/interview", label: "Interview Rehearsal", short: "Rehearse", icon: Video },
  { href: "/profile", label: "Educator Profile", short: "Profile", icon: UserRound },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d: { demo: boolean }) => setDemo(d.demo))
      .catch(() => {});
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-line md:bg-white">
        <Link href="/" className="px-6 pb-6 pt-7">
          <Logo />
          <span className="mt-1 block pl-9 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">{t("Career dashboard")}</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded px-3 py-2.5 text-sm font-semibold transition ${
                isActive(href) ? "bg-gold-50 text-gold-700" : "text-ink hover:bg-cream"
              }`}
            >
              <Icon size={18} />
              {t(label)}
            </Link>
          ))}
        </nav>
        <LanguageSwitcher className="mx-3 mb-1 mt-4" />
        <div className="m-3 rounded-md bg-brand-500 p-4 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-400">
            <Sparkles size={14} /> {t("Tip")}
          </p>
          <p className="mt-2 font-display text-lg italic leading-snug text-white">{t("Paste the centre's “About us” page into a saved job so your letters and mock interviews use its own words.")}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        {demo && (
          <div className="bg-gold-50 px-4 py-2 text-center text-sm text-gold-700">
            <Rich text="Demo mode: add <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code> for real AI-written letters and interviews." />
          </div>
        )}
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 md:hidden">
          <Link href="/">
            <Logo />
          </Link>
          <LanguageSwitcher className="w-32" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      <Toaster
        position="bottom-right"
        mobileOffset={{ bottom: 80 }}
        toastOptions={{
          classNames: {
            toast: "!rounded-md !border-line !bg-white !text-ink !font-sans !shadow-lg",
            description: "!text-body",
            actionButton: "!bg-brand-500 !text-white !rounded !font-semibold",
          },
        }}
      />

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-line bg-white md:hidden">
        {NAV.map(({ href, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive(href) ? "text-gold-700" : "text-slate-500"}`}
          >
            <Icon size={20} />
            {t(short)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** The Hire Me ECE wordmark: three rising dots, "Hire Me" in navy and "ECE" in gold. */
function Logo() {
  const t = useT();
  return (
    <span className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <circle cx="4" cy="21" r="2.6" style={{ fill: "var(--color-brand-200)" }} />
        <circle cx="11" cy="14" r="3.2" style={{ fill: "var(--color-brand-300)" }} />
        <circle cx="19.5" cy="6.5" r="5" style={{ fill: "var(--color-gold-500)" }} />
      </svg>
      <span className="font-display text-2xl font-semibold leading-none text-ink">
        Hire Me <span className="text-gold-500">{t("ECE")}</span>
      </span>
    </span>
  );
}
