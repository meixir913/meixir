"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, ExternalLink, FileText, Loader2, MapPin, Search } from "lucide-react";
import { Card, EmptyState, Input, PageHeader, Select, Skeleton } from "@/components/ui";
import type { CentreSearchResult, SiteScan } from "@/lib/centres/types";
import { Rich, useT } from "@/lib/i18n";

interface CentresResponse {
  sample: boolean;
  snapshotAt?: string | null;
  finderConfigured: boolean;
  registerUpdatedAt: string | null;
  lastRun: { at: string; notes: string[] } | null;
  counts: {
    services: number;
    lookupsDone: number;
    lookupsTotal: number;
    websites: number;
    checked: number;
    byStatus: Record<string, number>;
  };
  sites: SiteScan[];
}

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const fmt = (n: number) => n.toLocaleString("en-AU");

export default function CentresPage() {
  const t = useT();
  const [data, setData] = useState<CentresResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [show, setShow] = useState<"all" | "hiring" | "portal">("all");
  const [tab, setTab] = useState<"hiring" | "find">("hiring");

  useEffect(() => {
    fetch("/api/centres")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Couldn't load centres. Refresh to try again."));
  }, []);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase();
    return data.sites.filter(
      (s) => (!q || `${s.name} ${s.domain} ${s.jobTitles.join(" ")}`.toLowerCase().includes(q)) && (!state || s.states.includes(state)) && (show === "all" || s.status === show),
    );
  }, [data, query, state, show]);

  const c = data?.counts;
  const stats = c
    ? [
        { label: t("Services in the ACECQA register"), value: fmt(c.services) },
        { label: t("Centre websites found"), value: fmt(c.websites) },
        { label: t("Careers pages checked"), value: fmt(c.checked) },
        { label: t("Hiring now"), value: fmt(c.byStatus.hiring ?? 0) },
      ]
    : [];

  return (
    <>
      <PageHeader
        eyebrow={t("From the ACECQA national register")}
        heading="Centres <em>Hiring</em>"
        subtitle={t(
          "Job Vacancies lists individual job ads. Centres Hiring starts from the centres themselves: every approved service in Australia, checked on its own website for open roles. Use it to find roles that never reach SEEK, or to target a centre you'd love to work at.",
        )}
      />

      <div role="tablist" aria-label={t("Centres Hiring")} className="mb-6 inline-flex rounded-md border border-line bg-white p-1">
        {(
          [
            { id: "hiring", label: t("Hiring now") },
            { id: "find", label: t("Find a centre") },
          ] as const
        ).map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`rounded px-4 py-2 text-sm font-semibold transition ${tab === x.id ? "bg-brand-500 text-white" : "text-body hover:bg-cream"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === "find" ? (
        <FindCentre />
      ) : (
        <>
          {error && <p className="mb-4 rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

          {data?.sample && (
            <div className="mb-6 rounded-md bg-gold-50 p-4 text-sm text-gold-700">
              <Rich text="These are <b>sample centres</b>. The scanner hasn't run yet. Once the site is live it imports the ACECQA register and starts checking centre websites." />
            </div>
          )}
          {data?.snapshotAt && (
        <div className="mb-6 rounded-md bg-gold-50 p-4 text-sm text-gold-700">
          {t("Results from a full scan of every centre in the ACECQA register on {date}. Once the site is live, the scanner re-checks websites automatically every few days.", {
            date: new Date(data.snapshotAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
          })}
        </div>
      )}
      {data && !data.sample && !data.snapshotAt && !data.finderConfigured && (
            <div className="mb-6 rounded-md bg-gold-50 p-4 text-sm text-gold-700">
              <Rich text="Website lookups are off. Add a <b>{a}</b> or <b>{b}</b> so the scanner can find each centre's website." vars={{ a: "BRAVE_SEARCH_API_KEY", b: "GOOGLE_PLACES_API_KEY" }} />
            </div>
          )}

          {c && !data?.sample && (
            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {stats.map((s) => (
                <Card key={s.label}>
                  <p className="font-display text-5xl font-semibold leading-none lining-nums">{s.value}</p>
                  <p className="mt-2 text-sm text-slate-500">{s.label}</p>
                </Card>
              ))}
              {c.lookupsTotal > 0 && c.lookupsDone < c.lookupsTotal && (
                <p className="col-span-full text-sm text-slate-500">
                  {t("Still finding websites: {done} of {total} lookups done. New centres appear here as they're checked.", { done: fmt(c.lookupsDone), total: fmt(c.lookupsTotal) })}
                </p>
              )}
            </div>
          )}

          <Card className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search centre, website or role")} className="pl-9" aria-label={t("Search centres")} />
            </div>
            <Select value={state} onChange={setState} options={[{ value: "", label: t("All states") }, ...STATES.map((s) => ({ value: s, label: s }))]} />
            <Select
              value={show}
              onChange={(v) => setShow(v as typeof show)}
              options={[
                { value: "all", label: t("Hiring or recruitment page") },
                { value: "hiring", label: t("Roles listed") },
                { value: "portal", label: t("Recruitment page only") },
              ]}
            />
          </Card>

          {!data ? (
            <div className="grid gap-3 md:grid-cols-2" aria-label={t("Loading centres")}>
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} className="space-y-3 p-4">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-3/4" />
                </Card>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState icon={<Building2 size={40} />} title={t("No centres match")}>
              {data.counts.checked ? t("Try another state or search.") : t("Centres with open roles will appear here once the scanner has checked their websites.")}
            </EmptyState>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visible.map((s) => (
                <Card key={s.domain} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold">{s.name}</h3>
                      <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} /> {s.states.join(" · ") || "Australia"}
                        </span>
                        {s.serviceCount > 1 && <span>{t("{n} services", { n: s.serviceCount })}</span>}
                        <span className="truncate">{s.domain}</span>
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.status === "hiring" ? "bg-leaf-50 text-leaf-600" : "bg-gold-50 text-gold-700"}`}>
                      {s.status === "hiring"
                        ? s.jobTitles.length === 1
                          ? t("1 open role")
                          : s.jobTitles.length
                            ? t("{n} open roles", { n: s.jobTitles.length })
                            : t("Hiring")
                        : t("Recruitment page")}
                    </span>
                  </div>
                  {s.jobTitles.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm">
                      {s.jobTitles.slice(0, 4).map((title) => (
                        <li key={title} className="truncate text-ink">
                          • {title}
                        </li>
                      ))}
                      {s.jobTitles.length > 4 && <li className="text-slate-500">+ {s.jobTitles.length - 4} more</li>}
                    </ul>
                  )}
                  {s.portal && <p className="mt-2 text-xs text-slate-500">{t("Via {portal}", { portal: s.portal })}</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                    <span className="text-xs text-slate-400">
                      {t("Checked {date}", {
                        date: new Date(s.checkedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
                      })}
                    </span>
                    {(s.careersUrl || s.homepage) && (
                      <a
                        href={s.careersUrl || s.homepage}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 border-b border-ink pb-0.5 text-sm font-semibold text-ink hover:border-gold-500 hover:text-gold-700"
                      >
                        {t("View careers page")} <ExternalLink size={13} />
                      </a>
                    )}
                    <LetterLink name={s.name} website={s.homepage} state={s.states.length === 1 ? s.states[0] : ""} />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {data?.registerUpdatedAt && (
            <p className="mt-8 text-xs text-slate-500">
              {t("Register imported {date}. Source: ACECQA National Registers. Websites are re-checked every few days; roles found also appear in Job Vacancies.", {
                date: new Date(data.registerUpdatedAt).toLocaleDateString("en-AU"),
              })}
            </p>
          )}
        </>
      )}
    </>
  );
}

function LetterLink({ name, website, suburb = "", state = "" }: { name: string; website: string | null; suburb?: string; state?: string }) {
  const t = useT();
  const q = new URLSearchParams({
    centre: name,
    ...(website ? { website } : {}),
    ...(suburb ? { suburb } : {}),
    ...(state ? { state } : {}),
  });
  return (
    <Link href={`/letters?${q}`} className="inline-flex items-center gap-1.5 rounded bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
      <FileText size={13} /> {t("Write Cover Letter")}
    </Link>
  );
}

const STATUS_LABEL: Record<string, string> = {
  hiring: "Hiring",
  portal: "Recruitment page",
  "no-openings": "No openings listed",
  "no-careers-page": "No careers page",
  unreachable: "Website unavailable",
  blocked: "Website not checked",
};

/** Search the whole register for one centre: by name, provider, suburb or postcode. */
function FindCentre() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [data, setData] = useState<{
    results: CentreSearchResult[];
    total: number;
    sample?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/centres/search?${new URLSearchParams({ q, state })}`, {
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, state]);

  return (
    <>
      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-body">
        {t(
          "Looking at a particular centre, or want to work close to home? Search every approved service in Australia and see whether it's hiring. Then write a cover letter for it, even if it hasn't advertised.",
        )}
      </p>
      <Card className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Centre name, suburb or postcode")} className="pl-9" aria-label={t("Find a centre")} />
          {loading && <Loader2 size={16} className="absolute right-3 top-3 animate-spin text-slate-400" />}
        </div>
        <Select value={state} onChange={setState} options={[{ value: "", label: t("All states") }, ...STATES.map((s) => ({ value: s, label: s }))]} />
      </Card>
      {data?.sample && <p className="mb-4 rounded-md bg-gold-50 p-3 text-sm text-gold-700">{t("Sample register: the real ACECQA register is imported once the site is live.")}</p>}

      {!data ? (
        <EmptyState icon={<Building2 size={40} />} title={t("Search for a centre")}>
          {t("Try a suburb like “Parramatta”, a postcode like “3186”, or a centre name.")}
        </EmptyState>
      ) : data.results.length === 0 ? (
        <EmptyState icon={<Building2 size={40} />} title={t("No centres match")}>
          {t("Check the spelling, or try the suburb or postcode instead.")}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {data.total > data.results.length
              ? t("Showing {shown} of {total} centres. Add a suburb or postcode to narrow it down.", { shown: data.results.length, total: fmt(data.total) })
              : data.total === 1
                ? t("1 centre")
                : t("{n} centres", { n: data.total })}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {data.results.map((r) => (
              <Card key={r.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold">{r.name}</h3>
                    <p className="mt-0.5 flex items-start gap-1 text-sm text-slate-500">
                      <MapPin size={13} className="mt-0.5 shrink-0" /> {[r.address, r.suburb, `${r.state} ${r.postcode}`.trim()].filter(Boolean).join(", ")}
                    </p>
                    {r.provider && r.provider !== r.name && <p className="text-xs text-slate-500">{r.provider}</p>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      r.status === "hiring" ? "bg-leaf-50 text-leaf-600" : r.status === "portal" ? "bg-gold-50 text-gold-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {r.status === "hiring" && r.jobTitles.length ? t("{n} open roles", { n: r.jobTitles.length }) : r.status ? t(STATUS_LABEL[r.status]) : t("Not checked yet")}
                  </span>
                </div>
                {r.jobTitles.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {r.jobTitles.slice(0, 3).map((title) => (
                      <li key={title} className="truncate text-ink">
                        • {title}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-end gap-3 pt-4">
                  {(r.careersUrl || r.website) && (
                    <a
                      href={r.careersUrl || r.website!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 border-b border-ink pb-0.5 text-sm font-semibold text-ink hover:border-gold-500 hover:text-gold-700"
                    >
                      {r.careersUrl ? t("View careers page") : t("Website")} <ExternalLink size={13} />
                    </a>
                  )}
                  <LetterLink name={r.name} website={r.website} suburb={r.suburb} state={r.state} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
