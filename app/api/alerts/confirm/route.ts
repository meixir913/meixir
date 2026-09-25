import { appUrl, confirmEmail } from "@/lib/alerts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The link in the confirmation email.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const ok = await confirmEmail(q.get("id") ?? "", q.get("token") ?? "");
  return Response.redirect(`${appUrl()}/vacancies?alerts=${ok ? "confirmed" : "invalid"}`, 303);
}
