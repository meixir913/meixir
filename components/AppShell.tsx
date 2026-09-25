"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, FileText, LayoutDashboard, Sparkles, UserRound, Video } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Job Tracker", icon: Briefcase },
  { href: "/cover-letter", label: "Cover Letter AI", icon: FileText },
  { href: "/interview", label: "Interview Prep", icon: Video },
  { href: "/profile", label: "My Profile", icon: UserRound },
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
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-orange-100 md:bg-white">
        <Link href="/" className="flex items-center gap-2 px-6 py-6">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500 text-lg font-extrabold text-white">H</span>
          <span className="leading-tight">
            <span className="block text-lg font-extrabold">Hire Me ECE</span>
            <span className="block text-xs text-slate-500">Job Seeker Dashboard</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="m-3 rounded-2xl bg-leaf-50 p-4 text-sm">
          <p className="flex items-center gap-1.5 font-bold text-leaf-600">
            <Sparkles size={16} /> Tip
          </p>
          <p className="mt-1 text-slate-600">Paste the centre's &ldquo;About us&rdquo; page into a job so your letters and mock interviews speak its language.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        {demo && (
          <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            Demo mode — add <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> to <code className="rounded bg-amber-100 px-1">.env.local</code> for real AI-written letters and interviews.
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-orange-100 bg-white md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive(href) ? "text-brand-600" : "text-slate-500"}`}
          >
            <Icon size={20} />
            {label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
