import { unsubscribe } from "@/lib/alerts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(message: string) {
  return new Response(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Job alerts · Hire Me ECE</title>
    <body style="margin:0;background:#faf7ef;font-family:Helvetica,Arial,sans-serif;color:#0f1f39;display:grid;place-items:center;min-height:100vh;padding:16px">
    <div style="max-width:440px;background:#fff;border:1px solid #ebe7e0;border-radius:6px;padding:32px;text-align:center">
    <p style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">Hire Me <span style="color:#c79e57">ECE</span></p>
    <p style="margin:0 0 20px;color:#4b4951">${message}</p>
    <a href="/vacancies" style="background:#0f1f39;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600">Back to vacancies</a>
    </div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

const what = (q: URLSearchParams) => (q.get("what") === "email" ? "email" : q.get("what") === "push" ? "push" : "all");

// The unsubscribe link in every email.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const ok = await unsubscribe(q.get("id") ?? "", q.get("token") ?? "", what(q));
  return page(ok ? "You're unsubscribed. You won't get any more job alert emails." : "That link has expired or was already used.");
}

// One-click unsubscribe from email clients (List-Unsubscribe-Post).
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  await unsubscribe(q.get("id") ?? "", q.get("token") ?? "", what(q));
  return new Response(null, { status: 204 });
}
