import type { JobStatus } from "./types";

/** Pedagogical approaches a centre may describe itself with. */
export const PHILOSOPHIES: { name: string; hint: string }[] = [
  { name: "Play-based", hint: "Learning through child-directed and guided play" },
  { name: "Emergent curriculum", hint: "Curriculum grows from children's interests and inquiry" },
  { name: "Reggio Emilia", hint: "Child as capable co-researcher, documentation, the environment as third teacher" },
  { name: "Montessori", hint: "Prepared environment, practical life, self-directed work, mixed ages" },
  { name: "Waldorf / Steiner", hint: "Rhythm, imaginative play, natural materials, arts" },
  { name: "HighScope", hint: "Plan-do-review, active participatory learning, key developmental indicators" },
  { name: "Bush kinder / nature-based", hint: "Outdoor learning on Country, risky play, seasonal cycles" },
  { name: "Aboriginal & Torres Strait Islander perspectives", hint: "Embedding culture, Country and community, cultural safety, reconciliation" },
  { name: "Inclusive / anti-bias", hint: "Every child belongs, equity, diversity and family partnership" },
  { name: "Faith-based", hint: "Programming grounded in a faith community's values" },
  { name: "Bilingual / immersion", hint: "French, Mandarin, or other language immersion" },
  { name: "School readiness", hint: "Early literacy, numeracy and transition to school" },
];

export const FRAMEWORKS = [
  "EYLF V2.0 (Belonging, Being & Becoming)",
  "My Time, Our Place V2.0 (OSHC)",
  "National Quality Standard (NQS)",
  "VEYLDF (Victoria)",
  "QKLG (Queensland kindergarten)",
];

export const AGE_GROUPS = ["Babies / nursery (0–2)", "Toddlers (2–3)", "Pre-kindy (3–4)", "Kindy / preschool (4–5)", "OSHC / school-age"];

export const ROLES = [
  "Early Childhood Educator (Cert III)",
  "Diploma Qualified Educator",
  "Early Childhood Teacher (ECT)",
  "Room Leader",
  "Educational Leader",
  "Assistant Centre Director",
  "Centre Director / Manager",
  "OSHC Educator",
];

export const INTERVIEW_FOCUS = [
  { id: "mixed", label: "Mixed (recommended)" },
  { id: "behavioural", label: "Behavioural (STAR stories)" },
  { id: "scenario", label: "Scenario / situational" },
  { id: "philosophy", label: "Philosophy & pedagogy" },
  { id: "families", label: "Families & teamwork" },
  { id: "leadership", label: "Leadership, NQS & compliance" },
] as const;

export type InterviewFocus = (typeof INTERVIEW_FOCUS)[number]["id"];

export const STATUSES: { id: JobStatus; label: string; color: string }[] = [
  { id: "saved", label: "Saved", color: "bg-slate-400" },
  { id: "applied", label: "Applied", color: "bg-brand-400" },
  { id: "interviewing", label: "Interviewing", color: "bg-gold-500" },
  { id: "offer", label: "Offer", color: "bg-leaf-500" },
  { id: "rejected", label: "Not selected", color: "bg-rose-300" },
];

export const LETTER_TONES = ["Warm & heartfelt", "Professional", "Confident & concise", "Enthusiastic"];
