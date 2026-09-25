"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import LanguageSwitcher from "./LanguageSwitcher";
import { Briefcase, Building2, FileText, LayoutDashboard, LogOut, Newspaper, Sparkles, UserRound, Video } from "lucide-react";
import { Rich, useT } from "@/lib/i18n";
import { AccountContext, type Account } from "@/lib/account";
import { clearLocalData, startSync } from "@/lib/storage";

/** Pages shown without the dashboard around them (and without needing an account). */
export const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

const NAV = [
  { href: "/", label: "Overview", short: "Overview", icon: LayoutDashboard },
  {
    href: "/vacancies",
    label: "Job Vacancies",
    short: "Jobs",
    icon: Newspaper,
  },
  {
    href: "/centres",
    label: "Centres Hiring",
    short: "Centres",
    icon: Building2,
  },
  {
    href: "/applications",
    label: "Applications",
    short: "Applied",
    icon: Briefcase,
  },
  { href: "/letters", label: "Cover Letter", short: "Letter", icon: FileText },
  { href: "/interview", label: "Interview Prep", short: "Prep", icon: Video },
  { href: "/profile", label: "My Profile", short: "Profile", icon: UserRound },
];

const TOASTER = (
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
);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (AUTH_PAGES.includes(pathname)) {
    return (
      <>
        {children}
        {TOASTER}
      </>
    );
  }
  return <SignedInShell>{children}</SignedInShell>;
}

function SignedInShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const [demo, setDemo] = useState(false);
  const [user, setUser] = useState<Account | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d: { demo: boolean }) => setDemo(d.demo))
      .catch(() => {});
  }, []);

  // Load the account and its saved work before showing any page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      const { user } = (await res.json()) as { user: Account };
      await startSync(user).catch(() => {});
      if (!cancelled) setUser(user);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearLocalData();
    // A full page load clears everything held in memory as well.
    window.location.assign("/login");
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream">
        <Logo />
        <span className="h-1 w-24 overflow-hidden rounded bg-line">
          <span className="block h-full w-1/2 animate-pulse bg-gold-500" />
        </span>
        <span className="sr-only">{t("Loading your dashboard…")}</span>
      </div>
    );
  }

  return (
    <AccountContext.Provider value={{ user, logout }}>
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
                className={`flex items-center gap-3 rounded px-3 py-2.5 text-sm font-semibold transition ${isActive(href) ? "bg-gold-50 text-gold-700" : "text-ink hover:bg-cream"}`}
              >
                <Icon size={18} />
                {t(label)}
              </Link>
            ))}
          </nav>
          <LanguageSwitcher className="mx-3 mb-1 mt-4" />
          <div className="mx-3 mt-2 flex items-center gap-3 rounded-md border border-line px-3 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-semibold text-white" aria-hidden>
              {initials(user.name || user.email)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{user.name || t("My account")}</span>
              <span className="block truncate text-xs text-slate-500">{user.email}</span>
            </span>
            <button onClick={logout} title={t("Log out")} aria-label={t("Log out")} className="rounded p-1.5 text-slate-500 hover:bg-cream hover:text-ink">
              <LogOut size={16} />
            </button>
          </div>
          <div className="m-3 rounded-md bg-brand-500 p-4 text-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-400">
              <Sparkles size={14} /> {t("Tip")}
            </p>
            <p className="mt-2 font-display text-lg italic leading-snug text-white">{t("Paste a centre's website into Cover Letter and we'll read its philosophy and programs for you.")}</p>
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
            <span className="flex items-center gap-2">
              <LanguageSwitcher className="w-32" />
              <button onClick={logout} title={t("Log out")} aria-label={t("Log out")} className="rounded p-2 text-slate-500 hover:bg-cream hover:text-ink">
                <LogOut size={18} />
              </button>
            </span>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>

        {TOASTER}

        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-line bg-white md:hidden">
          {NAV.map(({ href, short, icon: Icon }) => (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive(href) ? "text-gold-700" : "text-slate-500"}`}>
              <Icon size={20} />
              {t(short)}
            </Link>
          ))}
        </nav>
      </div>
    </AccountContext.Provider>
  );
}

const initials = (s: string) =>
  s
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** The Hire Me ECE wordmark: three rising dots, "Hire Me" in navy and "ECE" in gold. */
export function Logo() {
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
