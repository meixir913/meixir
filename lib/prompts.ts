import { EMPLOYMENT_TYPES, ROLE_TYPES } from "./jobtypes";
import type { InterviewTurn } from "./types";

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

// ---------------------------------------------------------------- Job analysis

export const ANALYZE_SYSTEM = `You read job postings and centre "About us" pages for early childhood education roles and extract structured facts. Only report what the text supports; use an empty string or empty list when something is not stated.`;

export const ANALYZE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "centre", "location", "state", "salary", "roleType", "employmentType", "philosophies", "curriculum", "philosophy", "programs", "requirements", "keywords"],
  properties: {
    title: { type: "string", description: "Job title" },
    centre: { type: "string", description: "Name of the centre or employer" },
    location: { type: "string", description: "Suburb and state" },
    state: { type: "string", enum: ["", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] },
    salary: { type: "string", description: "Pay or wage range as written, or empty" },
    roleType: { type: "string", enum: ["", ...ROLE_TYPES] },
    employmentType: { type: "string", enum: ["", ...EMPLOYMENT_TYPES] },
    philosophies: {
      type: "array",
      items: { type: "string" },
      description: "Pedagogical approaches the centre follows, using names from the provided list where they fit",
    },
    curriculum: { type: "string", description: "Frameworks and how the centre plans learning, in its own words" },
    philosophy: { type: "string", description: "The centre's philosophy and values, in its own words" },
    programs: { type: "string", description: "Rooms, age groups and special programs offered" },
    requirements: { type: "array", items: { type: "string" }, description: "Must-have qualifications and duties, each short" },
    keywords: { type: "array", items: { type: "string" }, description: "Distinctive words or phrases worth echoing in a letter" },
  },
} as const;

export interface JobAnalysis {
  title: string;
  centre: string;
  location: string;
  state: string;
  salary: string;
  roleType: string;
  employmentType: string;
  philosophies: string[];
  curriculum: string;
  philosophy: string;
  programs: string;
  requirements: string[];
  keywords: string[];
}

// ---------------------------------------------------------------- Interview

export function interviewSystem(s: InterviewSetup) {
  return `You are ${s.interviewerName}, the hiring lead at ${s.centre || "an early learning centre"}, running a live video interview with ${
    s.candidateName || "a candidate"
  } for the role of ${s.role}. The candidate is practising, and your words are spoken aloud by an avatar, so talk the way a warm, professional interviewer talks on a call.

How to run the interview:
- Ask ${s.questionCount} main questions in total, one at a time. Focus: ${s.focus}.
- Draw questions from what Australian early childhood hiring panels ask: image of the child, the centre's philosophy in practice, the EYLF learning outcomes, the National Quality Standard, guiding behaviour, inclusion and children with additional needs, partnerships with families, observation, planning and documentation, critical reflection, embedding Aboriginal and Torres Strait Islander perspectives, the Child Safe Standards and mandatory reporting, supervision and ratios, health and safety, conflict with co-workers, and routines and transitions. Tie questions to this centre's programs and philosophy when you know them.
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

export const FEEDBACK_SYSTEM = `You are an experienced Australian early learning centre director and interview coach. You review a transcript of a practice interview and give honest, encouraging, specific feedback that helps the candidate get hired. Judge answers on: concrete examples (STAR: situation, task, action, result), child-centred language and a strong image of the child, alignment with the centre's philosophy, knowledge of the EYLF, NQS, child safety, regulations and inclusion, family partnership, reflection, and clarity. Stronger answers you write must stay truthful to what the candidate said — improve structure and add what they should mention, but mark any invented example as "[your example]".`;

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
