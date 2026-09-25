import type { JobStatus } from "./types";

/** Pedagogical approaches a centre may describe itself with. */
export const PHILOSOPHIES: { name: string; hint: string }[] = [
  { name: "Play-based", hint: "Learning through child-directed and guided play" },
  { name: "Emergent curriculum", hint: "Curriculum grows from children's interests and inquiry" },
  { name: "Reggio Emilia", hint: "Child as capable co-researcher, documentation, the environment as third teacher" },
  { name: "Montessori", hint: "Prepared environment, practical life, self-directed work, mixed ages" },
  { name: "Waldorf / Steiner", hint: "Rhythm, imaginative play, natural materials, arts" },
  { name: "HighScope", hint: "Plan-do-review, active participatory learning, key developmental indicators" },
  { name: "Forest / nature-based", hint: "Outdoor and land-based learning, risky play, seasonal cycles" },
  { name: "Indigenous & land-based", hint: "Relational learning, Elders and community, culture and language" },
  { name: "Inclusive / anti-bias", hint: "Every child belongs, equity, diversity and family partnership" },
  { name: "Faith-based", hint: "Programming grounded in a faith community's values" },
  { name: "Bilingual / immersion", hint: "French, Mandarin, or other language immersion" },
  { name: "Academic / school readiness", hint: "Early literacy, numeracy and kindergarten transition" },
];

export const FRAMEWORKS = [
  "How Does Learning Happen? (Ontario)",
  "BC Early Learning Framework",
  "Flight (Alberta)",
  "Early Learning Framework (Manitoba / Saskatchewan)",
  "EYLF (Australia)",
  "Te Whāriki (New Zealand)",
  "EYFS (England)",
  "NAEYC / DAP (US)",
];

export const AGE_GROUPS = ["Infant (0–18m)", "Toddler (18m–2.5y)", "Preschool (2.5–4y)", "Kindergarten", "School-age"];

export const ROLES = [
  "Registered Early Childhood Educator (RECE)",
  "Early Childhood Educator",
  "ECE Assistant",
  "Infant/Toddler Educator",
  "Preschool Lead Educator",
  "Room Lead / Senior ECE",
  "Centre Supervisor / Director",
  "Resource Consultant / Inclusion Support",
];

export const INTERVIEW_FOCUS = [
  { id: "mixed", label: "Mixed (recommended)" },
  { id: "behavioural", label: "Behavioural (STAR stories)" },
  { id: "scenario", label: "Scenario / situational" },
  { id: "philosophy", label: "Philosophy & pedagogy" },
  { id: "families", label: "Families & teamwork" },
  { id: "leadership", label: "Leadership & compliance" },
] as const;

export type InterviewFocus = (typeof INTERVIEW_FOCUS)[number]["id"];

export const STATUSES: { id: JobStatus; label: string; color: string }[] = [
  { id: "saved", label: "Saved", color: "bg-slate-400" },
  { id: "applied", label: "Applied", color: "bg-sky-500" },
  { id: "interviewing", label: "Interviewing", color: "bg-amber-500" },
  { id: "offer", label: "Offer", color: "bg-emerald-500" },
  { id: "rejected", label: "Not selected", color: "bg-rose-400" },
];

export const LETTER_TONES = ["Warm & heartfelt", "Professional", "Confident & concise", "Enthusiastic"];
