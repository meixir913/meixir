import { describeError, generateJson, isDemoMode } from "@/lib/claude";
import { demoAlignment } from "@/lib/demo";
import { ALIGNMENT_SCHEMA, ALIGNMENT_SYSTEM, alignmentPrompt } from "@/lib/letter-prompts";
import { EMPTY_CENTRE, EMPTY_ROLE, type Alignment, type CentreDetails, type RoleDetails } from "@/lib/letter-types";
import { rateLimit } from "@/lib/rate-limit";
import { EMPTY_PROFILE, type Profile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// Maps the candidate's resume against the centre's curriculum, philosophy, programs and the job type.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "alignment");
  if (limited) return limited;
  const body = (await req.json()) as { profile: Profile; centre: CentreDetails; role: RoleDetails; locale?: string };
  const profile = { ...EMPTY_PROFILE, ...body.profile };
  const centre = { ...EMPTY_CENTRE, ...body.centre };
  const role = { ...EMPTY_ROLE, ...body.role };
  if (!profile.resume.trim()) return Response.json({ error: "Add your resume first." }, { status: 400 });
  if (isDemoMode()) return Response.json(demoAlignment(profile, centre, role));

  try {
    return Response.json(
      await generateJson<Alignment>({ system: ALIGNMENT_SYSTEM, prompt: alignmentPrompt(profile, centre, role, body.locale), schema: ALIGNMENT_SCHEMA, effort: "medium" }),
    );
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}
