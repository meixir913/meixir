import { SAMPLE_SERVICES, SAMPLE_SITES } from "@/lib/centres/sample";
import { loadCentreData } from "@/lib/centres/snapshot";
import type { WebsiteLookup } from "@/lib/centres/types";
import type { CentreSearchResult } from "@/lib/centres/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESULTS = 40;


// Search every approved service in the ACECQA register by centre name, provider, suburb or postcode,
// with what the centre scanner found on its website.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const words = (params.get("q") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const state = params.get("state") ?? "";
  if (!words.length) return Response.json({ results: [], total: 0 });

  const data = await loadCentreData();
  const sample = data.source === "sample";
  const [services, lookups, sites] = sample
    ? [SAMPLE_SERVICES, {} as Record<string, WebsiteLookup>, Object.fromEntries(SAMPLE_SITES.map((s) => [s.domain, s]))]
    : [Object.values(data.services), data.lookups, data.sites];

  const matches = services.filter((s) => {
    if (state && s.state !== state) return false;
    const hay = `${s.name} ${s.provider} ${s.suburb} ${s.postcode}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });

  const results: CentreSearchResult[] = matches.slice(0, MAX_RESULTS).map((s) => {
    const lookup = lookups[`s:${s.id}`] ?? lookups[`p:${s.providerId}`];
    const domain = "domain" in s ? (s as { domain: string | null }).domain : (lookup?.domain ?? null);
    const site = domain ? sites[domain] : undefined;
    return {
      id: s.id,
      name: s.name,
      provider: s.provider,
      address: s.address,
      suburb: s.suburb,
      state: s.state,
      postcode: s.postcode,
      places: s.places,
      website: site?.homepage || lookup?.url || (domain && !domain.endsWith(".example") ? `https://${domain}/` : null),
      careersUrl: site?.careersUrl ?? null,
      status: site?.status ?? null,
      jobTitles: site?.jobTitles ?? [],
      checkedAt: site?.checkedAt ?? null,
    };
  });
  // Centres that are hiring first.
  const rank = (r: CentreSearchResult) => (r.status === "hiring" ? 0 : r.status === "portal" ? 1 : 2);
  results.sort((a, b) => rank(a) - rank(b));
  return Response.json({ results, total: matches.length, sample });
}
