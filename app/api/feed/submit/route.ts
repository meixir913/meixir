import { describeError } from "@/lib/claude";
import { addJobs } from "@/lib/feed/collect";
import { extractJobs } from "@/lib/feed/sources/extract";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Someone pastes a job post from a Facebook group (or anywhere else). Claude pulls out the job
// details and it joins the shared feed. Set FEED_ADMIN_KEY to limit this to your team.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "feed-submit");
  if (limited) return limited;
  const { text, channel, key } = (await req.json()) as { text?: string; channel?: string; key?: string };
  if (process.env.FEED_ADMIN_KEY && key !== process.env.FEED_ADMIN_KEY) {
    return Response.json({ error: "That team key isn't right." }, { status: 401 });
  }
  if (!text?.trim()) return Response.json({ error: "Paste the post text first." }, { status: 400 });
  if (text.length > 20_000) return Response.json({ error: "That post is too long. Paste one post at a time." }, { status: 400 });

  try {
    const jobs = await extractJobs(text, { sourceKind: "community", source: channel?.trim() || "Facebook group" });
    const { added, found } = await addJobs(jobs);
    return Response.json({ found, added });
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}
