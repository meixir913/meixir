"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ExternalLink, MapPin, Search } from "lucide-react";
import { Card, EmptyState, Input, PageHeader, Select, Skeleton } from "@/components/ui";
import type { SiteScan } from "@/lib/centres/types";

interface CentresResponse {
  sample: boolean;
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
  const [data, setData] = useState<CentresResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [show, setShow] = useState<"all" | "hiring" | "portal">("all");

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
        { label: "Services in the ACECQA register", value: fmt(c.services) },
        { label: "Centre websites found", value: fmt(c.websites) },
        { label: "Careers pages checked", value: fmt(c.checked) },
        { label: "Centres hiring now", value: fmt(c.byStatus.hiring ?? 0) },
      ]
    : [];

  return (
    <>
      <PageHeader
        eyebrow="From the ACECQA national register"
        title="Centres"
        accent="Hiring"
        subtitle="Many centres only advertise on their own website. We check the careers page of every approved service in Australia and list the ones with open roles."
      />

      {error && <p className="mb-4 rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {data?.sample && (
        <div className="mb-6 rounded-md bg-gold-50 p-4 text-sm text-gold-700">
          These are <b>sample centres</b>. The scanner hasn&apos;t run yet. Once the site is live it imports the ACECQA register and starts checking centre websites (setup: DEPLOY.md, step 6).
        </div>
      )}
      {data && !data.sample && !data.finderConfigured && (
        <div className="mb-6 rounded-md bg-gold-50 p-4 text-sm text-gold-700">
          Website lookups are off. Add a <b>BRAVE_SEARCH_API_KEY</b> or <b>GOOGLE_PLACES_API_KEY</b> so the scanner can find each centre&apos;s website.
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
              Still finding websites: {fmt(c.lookupsDone)} of {fmt(c.lookupsTotal)} lookups done. New centres appear here as they&apos;re checked.
            </p>
          )}
        </div>
      )}

      <Card className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search centre, website or role" className="pl-9" aria-label="Search centres" />
        </div>
        <Select value={state} onChange={setState} options={[{ value: "", label: "All states" }, ...STATES.map((s) => ({ value: s, label: s }))]} />
        <Select
          value={show}
          onChange={(v) => setShow(v as typeof show)}
          options={[
            { value: "all", label: "Hiring or recruitment page" },
            { value: "hiring", label: "Roles listed" },
            { value: "portal", label: "Recruitment page only" },
          ]}
        />
      </Card>

      {!data ? (
        <div className="grid gap-3 md:grid-cols-2" aria-label="Loading centres">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="space-y-3 p-4">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<Building2 size={40} />} title="No centres match">
          {data.counts.checked ? "Try another state or search." : "Centres with open roles will appear here once the scanner has checked their websites."}
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
                    {s.serviceCount > 1 && <span>{s.serviceCount} services</span>}
                    <span className="truncate">{s.domain}</span>
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.status === "hiring" ? "bg-leaf-50 text-leaf-600" : "bg-gold-50 text-gold-700"}`}>
                  {s.status === "hiring" ? `${s.jobTitles.length || ""} open role${s.jobTitles.length === 1 ? "" : "s"}`.trim() : "Recruitment page"}
                </span>
              </div>
              {s.jobTitles.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {s.jobTitles.slice(0, 4).map((t) => (
                    <li key={t} className="truncate text-ink">
                      • {t}
                    </li>
                  ))}
                  {s.jobTitles.length > 4 && <li className="text-slate-500">+ {s.jobTitles.length - 4} more</li>}
                </ul>
              )}
              {s.portal && <p className="mt-2 text-xs text-slate-500">Via {s.portal}</p>}
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-xs text-slate-400">Checked {new Date(s.checkedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
                {(s.careersUrl || s.homepage) && (
                  <a
                    href={s.careersUrl || s.homepage}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 border-b border-ink pb-0.5 text-sm font-semibold text-ink hover:border-gold-500 hover:text-gold-700"
                  >
                    View careers page <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {data?.registerUpdatedAt && (
        <p className="mt-8 text-xs text-slate-500">
          Register imported {new Date(data.registerUpdatedAt).toLocaleDateString("en-AU")}. Source: ACECQA National Registers. Websites are re-checked every few days; roles found also appear in the ECE Job Feed.
        </p>
      )}
    </>
  );
}
