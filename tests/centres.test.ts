import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCsv, parseRegister } from "@/lib/centres/acecqa";
import { robotsAllows, scanSite, type ScanInput } from "@/lib/centres/careers";
import { ownSite } from "@/lib/centres/find-website";
import { groupServices, loadSites, runCentres } from "@/lib/centres/pipeline";
import { loadFeed } from "@/lib/feed/store";

/** Fetch stand-in: the longest matching URL prefix wins; anything else is a 404. */
const fakeFetch = (routes: Record<string, unknown>) =>
  vi.fn(async (input: string | URL | Request) => {
    const url = input.toString();
    const key = Object.keys(routes)
      .filter((k) => url.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (!key) return new Response("not found", { status: 404 });
    const body = routes[key];
    const res = new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status: 200,
      headers: { "content-type": typeof body === "string" ? "text/html" : "application/json" },
    });
    Object.defineProperty(res, "url", { value: url });
    return res;
  }) as unknown as typeof fetch;

const site = (over: Partial<ScanInput> = {}): ScanInput => ({
  domain: "wattle.example",
  homepage: "https://wattle.example/",
  name: "Wattle Grove Early Learning",
  states: ["NSW"],
  serviceCount: 1,
  location: "Parramatta NSW",
  ...over,
});

const HEADER = "ServiceApprovalNumber,Provider Approval Number,ServiceName,ProviderLegalName,ServiceType,ServiceAddress,Suburb,State,Postcode,Phone,NumberOfApprovedPlaces";

describe("ACECQA register", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("maps register columns into services", () => {
    const [s] = parseRegister(`${HEADER}\nSE-1,PR-1,"Wattle Grove Early Learning","Wattle Pty Ltd",Centre-Based Care,"1 Smith St",PARRAMATTA,NSW,2150,0290000000,90\n`);
    expect(s).toMatchObject({ id: "SE-1", providerId: "PR-1", name: "Wattle Grove Early Learning", suburb: "PARRAMATTA", state: "NSW", places: 90 });
  });

  it("groups multi-service providers into one website lookup", () => {
    const base = { provider: "Big Co", type: "", address: "", suburb: "Perth", state: "WA" as const, postcode: "", phone: "", places: null };
    const services = [
      { ...base, id: "1", name: "Big Co A", providerId: "P1" },
      { ...base, id: "2", name: "Big Co B", providerId: "P1" },
      { ...base, id: "3", name: "Big Co C", providerId: "P1" },
      { ...base, id: "4", name: "Solo Kids", providerId: "P2", provider: "Solo" },
    ];
    const groups = groupServices(services);
    expect(groups.map((g) => g.key).sort()).toEqual(["p:P1", "s:4"]);
    expect(groups.find((g) => g.key === "p:P1")?.serviceCount).toBe(3);
  });
});

describe("website finding", () => {
  it("rejects directories and social media", () => {
    expect(ownSite("https://www.facebook.com/wattle")).toBeNull();
    expect(ownSite("https://www.careforkids.com.au/child-care/x")).toBeNull();
    expect(ownSite("https://www.startingblocks.gov.au/find-child-care/x")).toBeNull();
    expect(ownSite("https://www.wattlegrove.com.au/about")).toEqual({ url: "https://www.wattlegrove.com.au/", domain: "wattlegrove.com.au" });
    expect(ownSite("https://hideandseek.com.au/")?.domain).toBe("hideandseek.com.au");
  });

  it("respects robots.txt", () => {
    const robots = "User-agent: *\nDisallow: /private\n\nUser-agent: BadBot\nDisallow: /";
    expect(robotsAllows(robots, "/careers")).toBe(true);
    expect(robotsAllows(robots, "/private/x")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /", "/")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /\nAllow: /careers", "/careers")).toBe(true);
  });
});

describe("careers page scan", () => {
  it("reads JobPosting data from the careers page", async () => {
    const fetcher = fakeFetch({
      "https://wattle.example/": `<a href="/join-our-team">Join our team</a>`,
      "https://wattle.example/join-our-team": `<h1>Careers</h1><script type="application/ld+json">{"@type":"JobPosting","title":"Room Leader – Toddlers"}</script>`,
    });
    const { scan, jobs } = await scanSite(site(), fetcher);
    expect(scan).toMatchObject({ status: "hiring", careersUrl: "https://wattle.example/join-our-team", jobTitles: ["Room Leader – Toddlers"] });
    expect(jobs[0]).toMatchObject({ employer: "Wattle Grove Early Learning", location: "Parramatta NSW", sourceKind: "provider", source: "Wattle Grove Early Learning website" });
  });

  it("recognises 'no current vacancies'", async () => {
    const fetcher = fakeFetch({
      "https://wattle.example/": `<a href="/careers">Careers</a>`,
      "https://wattle.example/careers": `<h1>Careers</h1><p>There are currently no vacancies. Please check back soon.</p>`,
    });
    expect((await scanSite(site(), fetcher)).scan.status).toBe("no-openings");
  });

  it("reads roles from a linked Workable account", async () => {
    const fetcher = fakeFetch({
      "https://wattle.example/": `<a href="https://apply.workable.com/wattle-grove/">Careers</a>`,
      "https://apply.workable.com/api/v1/widget/accounts/wattle-grove": { jobs: [{ title: "Early Childhood Teacher", city: "Parramatta", state: "NSW", url: "https://apply.workable.com/wattle-grove/j/1" }] },
    });
    const { scan, jobs } = await scanSite(site(), fetcher);
    expect(scan).toMatchObject({ status: "hiring", portal: "Workable" });
    expect(jobs[0].title).toBe("Early Childhood Teacher");
  });

  it("uses SEEK links on the careers page as roles", async () => {
    const fetcher = fakeFetch({
      "https://wattle.example/": `<a href="/careers">Careers</a>`,
      "https://wattle.example/careers": `<h1>Careers</h1><a href="https://www.seek.com.au/job/81234567">Diploma Educator – Nursery</a>`,
    });
    const { scan, jobs } = await scanSite(site(), fetcher);
    expect(scan.status).toBe("hiring");
    expect(jobs.map((j) => j.title)).toEqual(["Diploma Educator – Nursery"]);
  });

  it("marks a recruitment system it can't read as a portal", async () => {
    const fetcher = fakeFetch({
      "https://wattle.example/": `<a href="/careers">Careers</a>`,
      "https://wattle.example/careers": `<h1>Careers</h1><iframe src="https://wattle.elmotalent.com.au/careers/jobs"></iframe>`,
    });
    expect((await scanSite(site(), fetcher)).scan).toMatchObject({ status: "portal", portal: "ELMO" });
  });

  it("stops when robots.txt disallows crawling", async () => {
    const fetcher = fakeFetch({ "https://wattle.example/robots.txt": "User-agent: *\nDisallow: /", "https://wattle.example/": "<a href='/careers'>Careers</a>" });
    expect((await scanSite(site(), fetcher)).scan.status).toBe("blocked");
  });

  it("reports sites without a careers page", async () => {
    const fetcher = fakeFetch({ "https://wattle.example/": `<a href="/about">About us</a>` });
    expect((await scanSite(site(), fetcher)).scan.status).toBe("no-careers-page");
  });
});

describe("runCentres", () => {
  beforeEach(() => {
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "centres-"));
    process.env.BRAVE_SEARCH_API_KEY = "test";
  });
  afterEach(() => {
    delete process.env.BRAVE_SEARCH_API_KEY;
  });

  it("imports the register, finds websites, scans careers pages and adds jobs to the feed", async () => {
    const register = `${HEADER}\nSE-1,PR-1,Wattle Grove Early Learning,Wattle Pty Ltd,Centre-Based Care,1 Smith St,Parramatta,NSW,2150,,90\nSE-2,PR-2,Banksia Kids,Banksia Pty Ltd,Centre-Based Care,2 Jones St,Penrith,NSW,2750,,40\n`;
    const fetcher = fakeFetch({
      "https://www.acecqa.gov.au/sites/default/files/national-registers/services/Education-services-nsw-export.csv": register,
      "https://www.acecqa.gov.au/sites/default/files/national-registers/services/": HEADER,
      "https://api.search.brave.com/res/v1/web/search?q=Wattle": { web: { results: [{ url: "https://www.facebook.com/wattle" }, { url: "https://wattle.example/" }] } },
      "https://api.search.brave.com/res/v1/web/search?q=Banksia": { web: { results: [{ url: "https://www.careforkids.com.au/banksia" }] } },
      "https://wattle.example/": `<a href="/careers">Careers</a>`,
      "https://wattle.example/careers": `<h1>Careers</h1><script type="application/ld+json">{"@type":"JobPosting","title":"Diploma Educator"}</script>`,
    });

    const run = await runCentres({ fetcher });
    expect(run).toMatchObject({ registerRefreshed: true, lookedUp: 2, scanned: 1, jobsAdded: 1 });

    const sites = await loadSites();
    expect(sites["wattle.example"]).toMatchObject({ status: "hiring", serviceCount: 1 });
    const feed = await loadFeed();
    expect(feed.jobs[0]).toMatchObject({ title: "Diploma Educator", employer: "Wattle Grove Early Learning", state: "NSW", source: "Wattle Grove Early Learning website" });

    // The next hourly run doesn't repeat lookups or re-download the register, and the site isn't due yet.
    const again = await runCentres({ fetcher });
    expect(again).toMatchObject({ registerRefreshed: false, lookedUp: 0, scanned: 0 });
  });
});
