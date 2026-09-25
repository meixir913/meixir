import { appUrl, emailConfigured, emailLayout, sendEmail } from "@/lib/alerts/service";
import { createResetToken, findUserByEmail } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Always answers the same way, so it can't be used to find out who has an account.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "forgot");
  if (limited) return limited;
  const { email } = (await req.json()) as { email?: string };
  const user = email ? await findUserByEmail(email) : null;
  if (user) {
    // Without APP_URL (e.g. running locally), link back to whichever address the request came to.
    const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL ? appUrl() : new URL(req.url).origin;
    const link = `${base}/reset-password?token=${await createResetToken(user.id)}`;
    if (emailConfigured()) {
      await sendEmail({
        to: user.email,
        subject: "Reset your Hire Me ECE password",
        html: emailLayout(
          "Reset your password",
          `<p>Click the button below to choose a new password. The link works for one hour.</p>
           <p style="margin:28px 0"><a href="${link}" style="background:#0f1f39;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:600">Choose a new password</a></p>
           <p>If you didn't ask for this, you can ignore this email. Your password won't change.</p>`,
          null,
        ),
        text: `Reset your Hire Me ECE password (link works for one hour): ${link}`,
      }).catch(() => {});
    } else {
      // No email service yet (e.g. running locally): the link appears in the terminal instead.
      console.log(`\n[Hire Me ECE] Password reset link for ${user.email}:\n${link}\n`);
    }
  }
  return Response.json({ ok: true });
}
