import { emailConfigured, getSubscriber, pushConfigured, unsubscribe, upsertSubscriber } from "@/lib/alerts/service";
import type { AlertPrefs, PushKeys, Subscriber } from "@/lib/alerts/types";
import { describeError } from "@/lib/claude";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicView = (s: Subscriber) => ({ id: s.id, token: s.token, email: s.email, emailStatus: s.emailStatus, push: Boolean(s.push), prefs: s.prefs });

// GET without id: which delivery channels this site supports. With id + token: that person's alerts.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const config = { email: emailConfigured(), push: pushConfigured(), vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null };
  const id = q.get("id");
  const token = q.get("token");
  if (!id || !token) return Response.json({ config });
  const s = await getSubscriber(id, token);
  return Response.json({ config, subscriber: s ? publicView(s) : null });
}

export async function POST(req: Request) {
  const limited = await rateLimit(req, "alerts");
  if (limited) return limited;
  const body = (await req.json()) as { id?: string; token?: string; email?: string | null; push?: PushKeys | null; prefs?: AlertPrefs; locale?: string };
  if (!body.email && !body.push && !(body.id && body.token)) return Response.json({ error: "Choose email, notifications, or both." }, { status: 400 });
  try {
    const { subscriber, confirmationSent } = await upsertSubscriber(body);
    return Response.json({ subscriber: publicView(subscriber), confirmationSent, emailConfigured: emailConfigured() });
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const { id, token } = (await req.json()) as { id: string; token: string };
  return Response.json({ ok: await unsubscribe(id, token, "all") });
}
