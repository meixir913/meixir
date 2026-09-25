import { fakeStream, isDemoMode, streamText, textStreamResponse } from "@/lib/claude";
import { demoCoverLetter } from "@/lib/demo";
import { COVER_LETTER_SYSTEM, coverLetterPrompt, type JobContext } from "@/lib/prompts";
import { EMPTY_PROFILE, type Profile } from "@/lib/types";

export const runtime = "nodejs";

interface Body {
  profile: Profile;
  job: JobContext;
  tone: string;
  length: "short" | "standard";
  extra: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const profile = { ...EMPTY_PROFILE, ...body.profile };
  if (!body.job?.description?.trim() && !body.job?.centreInfo?.trim()) {
    return new Response("Add the job description or the centre's programs and philosophy first.", { status: 400 });
  }
  if (isDemoMode()) return textStreamResponse(fakeStream(demoCoverLetter(profile, body.job)));

  return textStreamResponse(
    streamText({
      system: COVER_LETTER_SYSTEM,
      messages: [{ role: "user", content: coverLetterPrompt({ ...body, profile }) }],
      effort: "medium",
    }),
  );
}
