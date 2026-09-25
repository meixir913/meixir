import { finderConfigured } from "@/lib/centres/find-website";
import { loadLookups, loadMeta, loadSites } from "@/lib/centres/pipeline";
import { SAMPLE_SITES } from "@/lib/centres/sample";
import type { SiteStatus } from "@/lib/centres/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [meta, lookups, sites] = await Promise.all([loadMeta(), loadLookups(), loadSites()]);
  const all = Object.values(sites);
  const byStatus = all.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {});
  const groups = Object.values(lookups);
  const sample = meta.serviceCount === 0 && all.length === 0;
  const listed: SiteStatus[] = ["hiring", "portal"];
  return Response.json({
    sample,
    finderConfigured: finderConfigured(),
    registerUpdatedAt: meta.registerUpdatedAt,
    lastRun: meta.lastRun,
    counts: {
      services: meta.serviceCount,
      lookupsDone: groups.filter((g) => g.lookedUpAt).length,
      lookupsTotal: groups.length,
      websites: new Set(groups.map((g) => g.domain).filter(Boolean)).size,
      checked: all.length,
      byStatus,
    },
    sites: (sample ? SAMPLE_SITES : all.filter((s) => listed.includes(s.status))).sort(
      (a, b) => Number(b.status === "hiring") - Number(a.status === "hiring") || b.jobTitles.length - a.jobTitles.length || b.serviceCount - a.serviceCount,
    ),
  });
}
