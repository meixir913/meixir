// Finds a centre's or provider's own website. The ACECQA register has no website column, so each
// lookup uses a search API. Google Places is preferred when configured (it returns the website the
// business itself listed); otherwise Brave Search.

/** Directories, social networks and job boards: never a centre's own website. */
const NOT_OWN_SITE =
  /(^|\.)(facebook|instagram|linkedin|youtube|tiktok|twitter|x|google|goo|bing|wikipedia|seek|indeed|jora|careerone|gumtree|ethicaljobs|yellowpages|truelocal|localsearch|hotfrog|yelp|startlocal|careforkids|kindicare|toddle|childcarecentres|childcarefinder|mychild|startingblocks|acecqa|productreview|aussieweb|womo|whitecoat|healthengine|apple|maps)\.|\.gov\.au$/i;

export const finderConfigured = () => Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.BRAVE_SEARCH_API_KEY);

export function ownSite(url: string): { url: string; domain: string } | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const domain = u.hostname.replace(/^www\./, "").toLowerCase();
    if (NOT_OWN_SITE.test(`.${domain}`) || NOT_OWN_SITE.test(domain)) return null;
    return { url: `${u.protocol}//${u.hostname}/`, domain };
  } catch {
    return null;
  }
}

export async function findWebsite(query: string, fetcher: typeof fetch = fetch): Promise<{ url: string; domain: string } | null> {
  if (process.env.GOOGLE_PLACES_API_KEY) return findWithPlaces(query, fetcher);
  if (process.env.BRAVE_SEARCH_API_KEY) return findWithBrave(query, fetcher);
  throw new Error("No search API configured. Set GOOGLE_PLACES_API_KEY or BRAVE_SEARCH_API_KEY.");
}

// https://developers.google.com/maps/documentation/places/web-service/text-search
async function findWithPlaces(query: string, fetcher: typeof fetch) {
  const res = await fetcher("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": "places.websiteUri,places.displayName",
    },
    body: JSON.stringify({ textQuery: query, regionCode: "AU", pageSize: 3 }),
  });
  if (!res.ok) throw new Error(`Google Places returned ${res.status}`);
  const data = (await res.json()) as { places?: { websiteUri?: string }[] };
  for (const p of data.places ?? []) {
    const site = p.websiteUri ? ownSite(p.websiteUri) : null;
    if (site) return site;
  }
  return null;
}

// https://api-dashboard.search.brave.com/app/documentation/web-search
async function findWithBrave(query: string, fetcher: typeof fetch) {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("country", "AU");
  url.searchParams.set("count", "10");
  const res = await fetcher(url, { headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY! } });
  if (res.status === 429) throw new Error("Brave Search rate limit reached");
  if (!res.ok) throw new Error(`Brave Search returned ${res.status}`);
  const data = (await res.json()) as { web?: { results?: { url: string }[] } };
  for (const r of data.web?.results ?? []) {
    const site = ownSite(r.url);
    if (site) return site;
  }
  return null;
}
