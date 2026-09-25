import { fakeStream, isDemoMode, streamText, textStreamResponse } from "@/lib/claude";
import { demoLetter } from "@/lib/demo";
import { LETTER_SYSTEM, letterPrompt } from "@/lib/letter-prompts";
import { EMPTY_CENTRE, EMPTY_ROLE, type AlignmentItem, type CentreDetails, type RoleDetails } from "@/lib/letter-types";
import { rateLimit } from "@/lib/rate-limit";
import { EMPTY_PROFILE, type Profile } from "@/lib/types";

export const runtime = "nodejs";

interface Body {
  profile: Profile;
  centre: CentreDetails;
  role: RoleDetails;
  alignment: AlignmentItem[];
  tone: string;
  length: "short" | "standard";
  extra: string;
}

// Streams a cover letter: resume evidence mapped to this centre's curriculum, philosophy and programs.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "letter");
  if (limited) return limited;
  const body = (await req.json()) as Body;
  const profile = { ...EMPTY_PROFILE, ...body.profile };
  const centre = { ...EMPTY_CENTRE, ...body.centre };
  const role = { ...EMPTY_ROLE, ...body.role };
  if (!profile.resume.trim()) return Response.json({ error: "Add your resume first. The letter is built from it." }, { status: 400 });
  if (!centre.curriculum.trim() && !centre.philosophy.trim() && !centre.programs.trim()) {
    return Response.json({ error: "Add the centre's curriculum, philosophy or programs so the letter can match you to them." }, { status: 400 });
  }
  if (isDemoMode()) return textStreamResponse(fakeStream(demoLetter(profile, centre, role, body.alignment ?? [])));

  return textStreamResponse(
    streamText({
      system: LETTER_SYSTEM,
      messages: [{ role: "user", content: letterPrompt({ ...body, profile, centre, role, alignment: body.alignment ?? [] }) }],
      effort: "medium",
    }),
  );
}
