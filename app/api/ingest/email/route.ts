import { describeError } from "@/lib/claude";
import { addJobs } from "@/lib/feed/collect";
import { extractJobs } from "@/lib/feed/sources/extract";

export const runtime = "nodejs";
export const maxDuration = 120;

// Inbound email webhook for SEEK, Indeed and LinkedIn job alerts.
// Point an inbound-email service (Postmark, SendGrid Inbound Parse, Mailgun Routes, Cloudflare Email Workers)
// at /api/ingest/email?token=INBOUND_EMAIL_TOKEN and subscribe that address to job alerts.

function channelFor(from: string) {
  if (/seek/i.test(from)) return "SEEK alert";
  if (/indeed/i.test(from)) return "Indeed alert";
  if (/linkedin/i.test(from)) return "LinkedIn alert";
  if (/ethicaljobs/i.test(from)) return "EthicalJobs alert";
  return "Email alert";
}

async function readEmail(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    // Postmark style, or a custom forwarder.
    const b = (await req.json()) as Record<string, string | undefined>;
    return { from: b.From ?? b.from ?? "", subject: b.Subject ?? b.subject ?? "", body: b.HtmlBody ?? b.html ?? b.TextBody ?? b.text ?? "" };
  }
  // SendGrid Inbound Parse and Mailgun post form data.
  const f = await req.formData();
  const get = (...keys: string[]) => keys.map((k) => f.get(k)).find((v): v is string => typeof v === "string") ?? "";
  return { from: get("from", "sender"), subject: get("subject"), body: get("html", "body-html", "text", "body-plain") };
}

export async function POST(req: Request) {
  const token = process.env.INBOUND_EMAIL_TOKEN;
  if (!token || new URL(req.url).searchParams.get("token") !== token) {
    return Response.json({ error: "Unknown token." }, { status: 401 });
  }
  try {
    const email = await readEmail(req);
    const jobs = await extractJobs(`Subject: ${email.subject}\n\n${email.body}`, { sourceKind: "email-alert", source: channelFor(email.from) });
    const { added, found } = await addJobs(jobs);
    return Response.json({ found, added: added.length });
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}
