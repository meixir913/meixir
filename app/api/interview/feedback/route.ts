import { describeError, generateJson, isDemoMode } from "@/lib/claude";
import { demoFeedback } from "@/lib/demo";
import { FEEDBACK_SCHEMA, FEEDBACK_SYSTEM, feedbackPrompt, type InterviewSetup } from "@/lib/prompts";
import type { InterviewFeedback, InterviewTurn } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const limited = await rateLimit(req, "feedback");
  if (limited) return limited;
  const { setup, turns } = (await req.json()) as { setup: InterviewSetup; turns: InterviewTurn[] };
  if (!turns?.some((t) => t.role === "candidate")) {
    return Response.json({ error: "Answer at least one question to get feedback." }, { status: 400 });
  }
  if (isDemoMode()) return Response.json(demoFeedback(turns));

  try {
    const feedback = await generateJson<InterviewFeedback>({
      system: FEEDBACK_SYSTEM,
      prompt: feedbackPrompt(setup, turns),
      schema: FEEDBACK_SCHEMA,
      effort: "high",
    });
    return Response.json(feedback);
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}
