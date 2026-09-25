import { describeError, generateJson, isDemoMode } from "@/lib/claude";
import { demoCentre } from "@/lib/demo";
import { clean } from "@/lib/feed/classify";
import { CENTRE_SCHEMA, CENTRE_SYSTEM } from "@/lib/letter-prompts";
import type { CentreDetails } from "@/lib/letter-types";
import { rateLimit } from "@/lib/rate-limit";
import { fetchPublicPage } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const maxDuration = 60;

// Reads a centre's website (home page plus its about / philosophy / curriculum / programs pages)
// and summarises its curriculum, philosophy and programs for the letter.
const USEFUL_PAGE = /about|philosoph|curricul|program|our (centre|service|approach)|approach|learning|kinder|educat|values|rooms/i;

export async function POST(req: Request) {
  const limited = await rateLimit(req, "centre-profile");
  if (limited) return limited;
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) return Response.json({ error: "Enter the centre's website address." }, { status: 400 });

  try {
    const home = await fetchPublicPage(url);
    const host = new URL(home.url).hostname;
    const links = Array.from(home.html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi))
      .map((m) => {
        try {
          return { href: new URL(m[1], home.url).toString(), text: clean(m[2]) };
        } catch {
          return null;
        }
      })
      .filter((l): l is { href: string; text: string } => !!l && new URL(l.href).hostname === host && (USEFUL_PAGE.test(l.text) || USEFUL_PAGE.test(new URL(l.href).pathname)));
    const pages = [home];
    for (const link of Array.from(new Set(links.map((l) => l.href))).slice(0, 4)) {
      try {
        pages.push(await fetchPublicPage(link));
      } catch {
        // Skip pages that fail; the others are enough.
      }
    }
    const text = pages.map((p) => `--- ${p.url}\n${clean(p.html)}`).join("\n\n").slice(0, 60_000);

    const details: CentreDetails = isDemoMode()
      ? demoCentre(text)
      : { ...(await generateJson<Omit<CentreDetails, "website">>({ system: CENTRE_SYSTEM, prompt: `<website>\n${text}\n</website>`, schema: CENTRE_SCHEMA, effort: "low" })), website: "" };
    return Response.json({ ...details, website: home.url, pagesRead: pages.length });
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 400 });
  }
}
