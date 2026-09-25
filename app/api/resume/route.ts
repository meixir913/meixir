import mammoth from "mammoth";
import { describeError, generateJson, isDemoMode } from "@/lib/claude";
import { RESUME_SCHEMA, RESUME_SYSTEM } from "@/lib/letter-prompts";
import type { ResumeExtract } from "@/lib/letter-types";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 5 * 1024 * 1024;

// Reads an uploaded resume (PDF, Word or text) and returns profile details plus the resume as text.
// The file is processed in memory and not stored.
export async function POST(req: Request) {
  const limited = await rateLimit(req, "resume");
  if (limited) return limited;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a resume file to upload." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That file is over 5 MB. Try a smaller PDF or a Word file." }, { status: 400 });

  const name = file.name.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isDocx = name.endsWith(".docx") || file.type.includes("wordprocessingml");
  const isText = file.type.startsWith("text/") || name.endsWith(".txt");
  if (!isPdf && !isDocx && !isText) return Response.json({ error: "Upload a PDF, Word (.docx) or text file." }, { status: 400 });

  try {
    const text = isDocx ? (await mammoth.extractRawText({ buffer: bytes })).value : isText ? bytes.toString("utf8") : "";

    if (isDemoMode()) {
      if (isPdf) return Response.json({ error: "Reading PDF resumes needs the AI connected. In demo mode, upload a Word or text file." }, { status: 400 });
      return Response.json(demoExtract(text));
    }

    const extract = await generateJson<ResumeExtract>({
      system: RESUME_SYSTEM,
      prompt: isPdf
        ? [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") } },
            { type: "text", text: "Extract this resume." },
          ]
        : `<resume>\n${text.slice(0, 60_000)}\n</resume>\n\nExtract this resume.`,
      schema: RESUME_SCHEMA,
      effort: "low",
    });
    return Response.json(extract);
  } catch (err) {
    return Response.json({ error: describeError(err) }, { status: 500 });
  }
}

function demoExtract(text: string): ResumeExtract {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    name: lines[0] ?? "",
    email: (text.match(/[\w.+-]+@[\w-]+\.[\w.]+/) ?? [""])[0],
    phone: (text.match(/(\+?61|0)[\d ]{8,12}/) ?? [""])[0].trim(),
    city: (text.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)? (NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/) ?? [""])[0],
    credential: (text.match(/(Diploma|Certificate III|Cert III|Bachelor)[^\n,.]*/i) ?? [""])[0],
    registrationNumber: "",
    yearsExperience: (text.match(/(\d+)\+? years/i) ?? ["", ""])[1],
    ageGroups: [],
    certifications: (text.match(/(HLTAID\d+|first aid|CPR|anaphylaxis|asthma|child protection)[^\n]*/i) ?? [""])[0],
    strengths: "",
    personalPhilosophy: "",
    resumeText: text,
  };
}
