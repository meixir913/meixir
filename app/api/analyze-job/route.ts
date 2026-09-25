import { describeError, generateJson, isDemoMode } from "@/lib/claude";
import { demoAnalysis } from "@/lib/demo";
import { PHILOSOPHIES } from "@/lib/ece";
import { ANALYZE_SCHEMA, ANALYZE_SYSTEM, type JobAnalysis } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text: string };
  if (!text?.trim()) return Response.json({ error: "Paste a job posting first." }, { status: 400 });
  if (isDemoMode()) return Response.json(demoAnalysis(text));

  try {
    const analysis = await generateJson<JobAnalysis>({
      system: ANALYZE_SYSTEM,
      prompt: `Known approach names: ${PHILOSOPHIES.map((p) => p.name).join("; ")}\n\n<posting>\n${text}\n</posting>`,
      schema: ANALYZE_SCHEMA,
      effort: "low",
    });
    return Response.json(analysis);
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}
