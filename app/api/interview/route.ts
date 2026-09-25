import { fakeStream, isDemoMode, streamText, textStreamResponse } from "@/lib/claude";
import { demoInterviewerTurn } from "@/lib/demo";
import { interviewMessages, interviewSystem, type InterviewSetup } from "@/lib/prompts";
import type { InterviewTurn } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { setup, turns } = (await req.json()) as { setup: InterviewSetup; turns: InterviewTurn[] };
  if (isDemoMode()) return textStreamResponse(fakeStream(demoInterviewerTurn(setup, turns), 25));

  // Low effort keeps the interviewer's replies quick, like a real conversation.
  return textStreamResponse(
    streamText({
      system: interviewSystem(setup),
      messages: interviewMessages(turns, setup.questionCount),
      maxTokens: 4000,
      effort: "low",
    }),
  );
}
