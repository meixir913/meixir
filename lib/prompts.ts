import type { InterviewTurn, Profile } from "./types";

export interface JobContext {
  title: string;
  centre: string;
  location?: string;
  description: string;
  centreInfo: string;
  philosophies: string[];
}

export interface InterviewSetup {
  role: string;
  centre: string;
  centreInfo: string;
  jobDescription: string;
  philosophies: string[];
  focus: string;
  questionCount: number;
  candidateName: string;
  interviewerName: string;
}

const section = (label: string, body: string | undefined) =>
  body && body.trim() ? `<${label}>\n${body.trim()}\n</${label}>` : "";

export function profileBlock(p: Profile) {
  return [
    `Name: ${p.name || "(not provided)"}`,
    p.city && `City: ${p.city}`,
    p.email && `Email: ${p.email}`,
    p.phone && `Phone: ${p.phone}`,
    p.credential && `Credential: ${p.credential}${p.registrationNumber ? ` (registration #${p.registrationNumber})` : ""}`,
    p.yearsExperience && `Years of ECE experience: ${p.yearsExperience}`,
    p.ageGroups.length && `Age groups worked with: ${p.ageGroups.join(", ")}`,
    p.certifications && `Certifications: ${p.certifications}`,
    p.strengths && `Strengths / proud moments: ${p.strengths}`,
    p.personalPhilosophy && `Personal philosophy of care and learning: ${p.personalPhilosophy}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------- Cover letters

export const COVER_LETTER_SYSTEM = `You write cover letters for Early Childhood Educators (ECEs) applying to child care centres, preschools, and early learning programs.

What makes these letters work:
- They are specific to one centre. Name the centre and connect the candidate's real experience to that centre's programs, philosophy, and values as the centre itself describes them (for example Reggio-inspired documentation, Montessori prepared environments, forest school, emergent curriculum, anti-bias practice, or a provincial framework such as How Does Learning Happen?). Echo the centre's own language naturally rather than listing buzzwords.
- They show the candidate's image of the child and how they build relationships with children, families, and co-workers, using one or two concrete moments from their experience rather than generic claims.
- They reference credentials, registration, and safety certifications briefly where relevant to the posting.
- They respond to the job description's stated requirements without copying it.

Rules:
- Use only facts the candidate supplied. Never invent employers, dates, certifications, or anecdotes. If a detail would help but is missing, write around it gracefully rather than fabricating.
- Write in first person, in plain warm professional English, with Canadian spelling (centre, behaviour, program) unless the posting uses another convention.
- Output only the letter itself: a greeting, 3–4 paragraphs, and a sign-off with the candidate's name. No subject line, headings, markdown, or commentary before or after. Use "Dear Hiring Team," when no contact person is named.`;

export function coverLetterPrompt(input: {
  profile: Profile;
  job: JobContext;
  tone: string;
  length: "short" | "standard";
  extra: string;
}) {
  const { profile, job } = input;
  return [
    section("candidate_profile", profileBlock(profile)),
    section("candidate_resume", profile.resume),
    section(
      "position",
      [`Role: ${job.title || "Early Childhood Educator"}`, `Centre: ${job.centre || "(not named)"}`, job.location && `Location: ${job.location}`]
        .filter(Boolean)
        .join("\n"),
    ),
    section("job_description", job.description),
    section("centre_programs_and_philosophy", job.centreInfo),
    job.philosophies.length ? section("centre_pedagogical_approaches", job.philosophies.join(", ")) : "",
    section("what_the_candidate_wants_to_emphasize", input.extra),
    `Write the cover letter now. Tone: ${input.tone}. Length: ${
      input.length === "short" ? "about 220 words" : "about 350 words"
    }.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------- Job analysis

export const ANALYZE_SYSTEM = `You read job postings and centre "About us" pages for early childhood education roles and extract structured facts. Only report what the text supports; use an empty string or empty list when something is not stated.`;

export const ANALYZE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "centre", "location", "salary", "philosophies", "programs", "requirements", "keywords", "centreSummary"],
  properties: {
    title: { type: "string", description: "Job title" },
    centre: { type: "string", description: "Name of the centre or employer" },
    location: { type: "string" },
    salary: { type: "string", description: "Pay or wage range as written, or empty" },
    philosophies: {
      type: "array",
      items: { type: "string" },
      description: "Pedagogical approaches the centre follows, using names from the provided list where they fit",
    },
    programs: { type: "array", items: { type: "string" }, description: "Programs or age groups offered, e.g. Infant room, Before & after school" },
    requirements: { type: "array", items: { type: "string" }, description: "Must-have qualifications and duties, each short" },
    keywords: { type: "array", items: { type: "string" }, description: "Distinctive words or phrases worth echoing in a cover letter" },
    centreSummary: { type: "string", description: "2–4 sentences on the centre's programs, philosophy and values in its own terms" },
  },
} as const;

export interface JobAnalysis {
  title: string;
  centre: string;
  location: string;
  salary: string;
  philosophies: string[];
  programs: string[];
  requirements: string[];
  keywords: string[];
  centreSummary: string;
}

// ---------------------------------------------------------------- Interview

export function interviewSystem(s: InterviewSetup) {
  return `You are ${s.interviewerName}, the hiring lead at ${s.centre || "an early learning centre"}, running a live video interview with ${
    s.candidateName || "a candidate"
  } for the role of ${s.role}. The candidate is practising, and your words are spoken aloud by an avatar, so talk the way a warm, professional interviewer talks on a call.

How to run the interview:
- Ask ${s.questionCount} main questions in total, one at a time. Focus: ${s.focus}.
- Draw questions from what real ECE hiring panels ask: image of the child, the centre's philosophy in practice, guiding behaviour, supporting children with diverse needs and inclusion, building relationships with families, documentation and pedagogical narration, health and safety, ratios and supervision, duty to report, conflict with co-workers, transitions and routines, and self-reflection. Tie questions to this centre's programs and philosophy when you know them.
- After each answer, give one short natural reaction (a sentence at most — do not grade or coach during the interview), then ask the next question. You may ask one brief follow-up if an answer is vague, but it doesn't count toward the ${s.questionCount}.
- Keep every turn under 70 words. Plain spoken sentences only: no lists, markdown, stage directions, or emoji.
- Begin by greeting the candidate by name, introducing yourself and the centre in a sentence, and asking your first question.
- After the candidate answers the final question, thank them, say what happens next in a sentence, and end your turn with the exact token [END].

${section("centre_programs_and_philosophy", s.centreInfo)}
${s.philosophies.length ? section("centre_pedagogical_approaches", s.philosophies.join(", ")) : ""}
${section("job_description", s.jobDescription)}`.trim();
}

export function interviewMessages(turns: InterviewTurn[], questionCount: number) {
  const asked = turns.filter((t) => t.role === "interviewer").length;
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: "(The candidate has joined the video call.)" },
  ];
  for (const t of turns) {
    messages.push({ role: t.role === "interviewer" ? "assistant" : "user", content: t.text });
  }
  if (asked >= questionCount) {
    const last = messages[messages.length - 1];
    last.content += `\n\n(Interview note: that was the answer to the final question — close the interview now.)`;
  }
  return messages;
}

export const FEEDBACK_SYSTEM = `You are an experienced early childhood education centre director and interview coach. You review a transcript of a practice interview and give honest, encouraging, specific feedback that helps the candidate get hired. Judge answers on: concrete examples (STAR: situation, task, action, result), child-centred language and a strong image of the child, alignment with the centre's philosophy, knowledge of safety, regulations and inclusion, family partnership, reflection, and clarity. Stronger answers you write must stay truthful to what the candidate said — improve structure and add what they should mention, but mark any invented example as "[your example]".`;

export const FEEDBACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overallScore", "summary", "strengths", "improvements", "perQuestion"],
  properties: {
    overallScore: { type: "integer", description: "0–100" },
    summary: { type: "string", description: "2–3 sentence overall impression" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    perQuestion: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "score", "feedback", "strongerAnswer"],
        properties: {
          question: { type: "string" },
          score: { type: "integer", description: "1–5" },
          feedback: { type: "string" },
          strongerAnswer: { type: "string", description: "A model answer of about 90–130 words the candidate could give" },
        },
      },
    },
  },
} as const;

export function feedbackPrompt(setup: InterviewSetup, turns: InterviewTurn[]) {
  const transcript = turns
    .map((t) => `${t.role === "interviewer" ? "INTERVIEWER" : "CANDIDATE"}: ${t.text}`)
    .join("\n\n");
  return [
    `Role: ${setup.role}\nCentre: ${setup.centre || "(not named)"}`,
    section("centre_programs_and_philosophy", setup.centreInfo),
    setup.philosophies.length ? section("centre_pedagogical_approaches", setup.philosophies.join(", ")) : "",
    section("transcript", transcript),
    "Give feedback on every main question the candidate answered (skip greetings and the closing).",
  ]
    .filter(Boolean)
    .join("\n\n");
}
