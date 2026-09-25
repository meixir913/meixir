"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, FileText, LayoutDashboard, Newspaper, Sparkles, UserRound, Video } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/job-feed", label: "ECE Job Feed", short: "Jobs", icon: Newspaper },
  { href: "/jobs", label: "My Applications", short: "Tracker", icon: Briefcase },
  { href: "/cover-letter", label: "Cover Letter AI", short: "Letters", icon: FileText },
  { href: "/interview", label: "Interview Prep", short: "Interview", icon: Video },
  { href: "/profile", label: "My Profile", short: "Profile", icon: UserRound },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
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
          <span className="mt-1 block pl-9 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">Career dashboard</span>
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
              {label}
            </Link>
          ))}
        </nav>
        <div className="m-3 rounded-md bg-brand-500 p-4 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-400">
            <Sparkles size={14} /> Tip
          </p>
          <p className="mt-2 font-display text-lg italic leading-snug text-white">Paste the centre's &ldquo;About us&rdquo; page into a saved job so your letters and mock interviews use its own words.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        {demo && (
          <div className="bg-gold-50 px-4 py-2 text-center text-sm text-gold-700">
            Demo mode — add <code className="rounded bg-gold-100 px-1">ANTHROPIC_API_KEY</code> to <code className="rounded bg-gold-100 px-1">.env.local</code> for real AI-written letters and interviews.
          </div>
        )}
        <header className="flex items-center border-b border-line bg-white px-4 py-3 md:hidden">
          <Link href="/">
            <Logo />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-white md:hidden">
        {NAV.map(({ href, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive(href) ? "text-gold-700" : "text-slate-500"}`}
          >
            <Icon size={20} />
            {short}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** The Hire Me ECE wordmark: three rising dots, "Hire Me" in navy and "ECE" in gold. */
function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <circle cx="4" cy="21" r="2.6" style={{ fill: "var(--color-brand-200)" }} />
        <circle cx="11" cy="14" r="3.2" style={{ fill: "var(--color-brand-300)" }} />
        <circle cx="19.5" cy="6.5" r="5" style={{ fill: "var(--color-gold-500)" }} />
      </svg>
      <span className="font-display text-2xl font-semibold leading-none text-ink">
        Hire Me <span className="text-gold-500">ECE</span>
      </span>
    </span>
  );
}
