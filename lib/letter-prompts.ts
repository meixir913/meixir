import { AGE_GROUPS, PHILOSOPHIES } from "./ece";
import { STATE_CONTEXT } from "./jobtypes";
import { languageNote } from "./languages";
import type { AuState } from "./feed/types";
import type { AlignmentItem, CentreDetails, RoleDetails } from "./letter-types";
import type { Profile } from "./types";

// Prompts for the cover letter: read the resume, understand the centre, map the fit, write the letter.

const section = (label: string, body: string | undefined) => (body && body.trim() ? `<${label}>\n${body.trim()}\n</${label}>` : "");
const join = (...parts: string[]) => parts.filter(Boolean).join("\n\n");

/** What each job type is judged on, so the letter speaks to the right level. */
const ROLE_FOCUS: Record<string, string> = {
  "Educator (Cert III)": "warm, responsive care routines, building secure relationships with children and families, supervision and safety, working as part of a room team, and willingness to keep learning",
  "Diploma Educator": "planning and documenting learning against the EYLF outcomes, observation and reflection, supporting children's wellbeing and inclusion, and leading parts of the room program",
  "Early Childhood Teacher": "designing and leading an intentional teaching program, the preschool or kindergarten program, assessment for learning, critical reflection, mentoring educators, family partnerships, and teacher registration",
  "Room / Educational Leader": "leading and mentoring a team, guiding the educational program and practice, critical reflection, NQS Quality Area 1, and communication with families and management",
  "Centre Director": "service leadership and culture, NQS and regulatory compliance, assessment and rating, staffing and rostering, enrolments and occupancy, family and community partnerships, and budget awareness",
  OSHC: "My Time, Our Place V2.0, leisure-based programs for school-age children, child-led activities, supervision of larger groups, and partnership with the school",
  Cook: "nutritious menus for young children, allergy and dietary management, food safety, and involving children in food experiences",
  Educator: "relationships with children and families, safe and engaging environments, and teamwork",
};

export function candidateBlock(p: Profile) {
  return join(
    section(
      "candidate_profile",
      [
        `Name: ${p.name || "(not provided)"}`,
        p.city && `Location: ${p.city}`,
        p.credential && `Qualification: ${p.credential}`,
        p.registrationNumber && `WWCC / teacher registration: ${p.registrationNumber}`,
        p.yearsExperience && `Years in early childhood: ${p.yearsExperience}`,
        p.ageGroups.length && `Age groups: ${p.ageGroups.join(", ")}`,
        p.certifications && `Certifications: ${p.certifications}`,
        p.strengths && `Strengths and proud moments: ${p.strengths}`,
        p.personalPhilosophy && `Their philosophy of early learning: ${p.personalPhilosophy}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    section("candidate_resume", p.resume),
  );
}

export function centreBlock(c: CentreDetails, r: RoleDetails) {
  const state = STATE_CONTEXT[c.state as AuState];
  return join(
    section(
      "position",
      [
        `Centre: ${c.name || "(not named)"}${c.suburb ? `, ${c.suburb}` : ""}${c.state ? ` ${c.state}` : ""}`,
        `Role: ${r.title || r.roleType || "Early childhood educator"}`,
        r.roleType && `Job type: ${r.roleType}. Hiring panels for this level look for ${ROLE_FOCUS[r.roleType] ?? ROLE_FOCUS.Educator}.`,
        r.employmentType && `Employment: ${r.employmentType}`,
        state && `State context: ${c.state} services work with ${state.framework}. Early childhood teachers there hold ${state.teacherRegistration}.`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    section("centre_curriculum", c.curriculum),
    section("centre_philosophy", c.philosophy),
    section("centre_programs", c.programs),
    c.approaches.length ? section("centre_pedagogical_approaches", c.approaches.join(", ")) : "",
    section("job_description", r.description),
  );
}

// ---------------------------------------------------------------- Resume

export const RESUME_SYSTEM = `You read resumes of early childhood educators in Australia and extract their details. Only report what the resume states; use "" or [] when something isn't there. Never invent details.`;

export const RESUME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "email", "phone", "city", "credential", "registrationNumber", "yearsExperience", "ageGroups", "certifications", "strengths", "personalPhilosophy", "resumeText"],
  properties: {
    name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    city: { type: "string", description: "Suburb and state, e.g. Parramatta NSW" },
    credential: { type: "string", description: "Highest early childhood qualification, e.g. Diploma of Early Childhood Education and Care" },
    registrationNumber: { type: "string", description: "WWCC or teacher registration number if listed" },
    yearsExperience: { type: "string", description: "Total years in early childhood roles, as a number, if it can be worked out" },
    ageGroups: { type: "array", items: { type: "string", enum: AGE_GROUPS }, description: "Age groups they have worked with" },
    certifications: { type: "string", description: "First aid, CPR, asthma/anaphylaxis, child protection, food safety and similar, comma separated" },
    strengths: { type: "string", description: "3–5 concrete achievements or strengths from the resume, as short sentences" },
    personalPhilosophy: { type: "string", description: "Their stated philosophy of teaching or care, only if the resume includes one" },
    resumeText: { type: "string", description: "The full resume as clean plain text with headings and bullet points preserved" },
  },
} as const;

// ---------------------------------------------------------------- Centre website

export const CENTRE_SYSTEM = `You read the website (or, when there's no website, a job ad) of an Australian early learning service and summarise what a job applicant needs to understand it: how it approaches curriculum, its philosophy, and its programs. Use the centre's own language where you can. Only report what the text supports; use "" or [] when something isn't stated.`;

export const CENTRE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "suburb", "state", "curriculum", "philosophy", "programs", "approaches"],
  properties: {
    name: { type: "string" },
    suburb: { type: "string" },
    state: { type: "string", enum: ["", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] },
    curriculum: { type: "string", description: "Frameworks and how learning is planned and documented, 2–5 sentences" },
    philosophy: { type: "string", description: "The centre's philosophy and values, 2–5 sentences, quoting key phrases" },
    programs: { type: "string", description: "Rooms, age groups and special programs (e.g. funded kinder, bush kinder, languages, school readiness), as a short list" },
    approaches: { type: "array", items: { type: "string", enum: PHILOSOPHIES.map((p) => p.name) } },
  },
} as const;

// ---------------------------------------------------------------- Alignment map

export const ALIGNMENT_SYSTEM = `You are an experienced Australian early childhood recruiter. You compare a candidate's resume with what a specific centre values and the role requires, and map where they align.

Rules:
- Cover the centre's curriculum, its philosophy, its programs, and the job type's key requirements. Aim for 6–10 items, the most persuasive first.
- Evidence must come from the candidate's resume or profile, quoted or closely paraphrased. Never invent experience.
- strength: "strong" when the resume shows direct experience, "partial" when it shows related or transferable experience, "gap" when there is none.
- framing: one sentence on how the letter should present this. For a gap, suggest an honest angle (transferable experience, eagerness to learn, current study), or say it is best left out.`;

export const ALIGNMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "items"],
  properties: {
    summary: { type: "string", description: "Two sentences on the candidate's overall fit for this centre and role" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "centreElement", "evidence", "strength", "framing"],
        properties: {
          category: { type: "string", enum: ["curriculum", "philosophy", "program", "role"] },
          centreElement: { type: "string", description: "What the centre values or the role needs, a few words" },
          evidence: { type: "string", description: "Matching evidence from the resume, or empty for a gap" },
          strength: { type: "string", enum: ["strong", "partial", "gap"] },
          framing: { type: "string" },
        },
      },
    },
  },
} as const;

export function alignmentPrompt(profile: Profile, centre: CentreDetails, role: RoleDetails, locale?: string) {
  return join(
    candidateBlock(profile),
    centreBlock(centre, role),
    "Map how this candidate aligns with this centre and role.",
    languageNote(locale, "the evidence quotes and the centreElement names"),
  );
}

// ---------------------------------------------------------------- Letter

export const LETTER_SYSTEM = `You write cover letters for early childhood educators in Australia. Each letter is written for one specific centre and shows, with evidence from the candidate's resume, how their experience fits that centre's curriculum, philosophy and programs, and the job type they're applying for.

Structure:
1. Opening: the role and the centre by name, and a specific reason this centre appeals, drawn from its philosophy or programs (in the centre's own language where natural).
2. Alignment: one or two paragraphs built from the alignment points provided. Each claim is backed by a concrete example from the resume. Connect the example to what it means for children and families at this centre.
3. Role fit: what the candidate brings at this level (for example leading a kinder program as an ECT, mentoring as a room leader, or NQS leadership as a director). Mention qualifications, teacher registration and the state's framework only where relevant.
4. Close: availability for the stated employment type, and a warm invitation to meet or visit the centre.

Rules:
- Use only facts from the candidate's resume and profile. Never invent employers, dates, qualifications or anecdotes. Leave out gaps unless an honest framing is provided.
- Write in first person, in warm, professional Australian English (centre, behaviour, organisation, program). Never use US spelling.
- Avoid generic phrases such as "I am writing to express my interest" or "I believe I would be a great fit". Show, don't claim.
- Output only the letter: greeting, body and sign-off with the candidate's name. No subject line, headings, markdown or notes. Use "Dear Hiring Team," when no contact is named.`;

export function letterPrompt(input: {
  profile: Profile;
  centre: CentreDetails;
  role: RoleDetails;
  alignment: AlignmentItem[];
  tone: string;
  length: "short" | "standard";
  extra: string;
}) {
  const points = input.alignment
    .map((a) => `- [${a.category}, ${a.strength}] ${a.centreElement}: ${a.evidence || "(no direct experience)"}. Framing: ${a.framing}`)
    .join("\n");
  return join(
    candidateBlock(input.profile),
    centreBlock(input.centre, input.role),
    section("alignment_points_to_use", points),
    section("candidate_wants_to_emphasise", input.extra),
    `Write the letter now. Tone: ${input.tone}. Length: ${input.length === "short" ? "about 250 words" : "about 380 words"}.`,
  );
}
