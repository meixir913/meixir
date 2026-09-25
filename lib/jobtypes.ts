import type { AuState, RoleLevel } from "./feed/types";

// Shared by the vacancies filters, job alerts, the cover letter and the educator profile.

export const AU_STATES: { id: AuState; name: string }[] = [
  { id: "NSW", name: "New South Wales" },
  { id: "VIC", name: "Victoria" },
  { id: "QLD", name: "Queensland" },
  { id: "WA", name: "Western Australia" },
  { id: "SA", name: "South Australia" },
  { id: "TAS", name: "Tasmania" },
  { id: "ACT", name: "Australian Capital Territory" },
  { id: "NT", name: "Northern Territory" },
];

/** Job types, from the entry-level educator up to centre leadership. */
export const ROLE_TYPES: RoleLevel[] = [
  "Educator (Cert III)",
  "Diploma Educator",
  "Early Childhood Teacher",
  "Room / Educational Leader",
  "Centre Director",
  "OSHC",
  "Cook",
  "Educator",
];

export const EMPLOYMENT_TYPES = ["Full time", "Part time", "Casual", "Contract"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/** Normalises free-text employment details ("full_time, permanent", "Casual shifts") to one type. */
export function employmentKind(...texts: string[]): EmploymentType | "" {
  const t = texts.join(" ").toLowerCase();
  if (/casual|relief/.test(t)) return "Casual";
  if (/part[\s_-]?time/.test(t)) return "Part time";
  if (/contract|temporary|fixed[\s_-]?term|maternity/.test(t)) return "Contract";
  if (/full[\s_-]?time|permanent/.test(t)) return "Full time";
  return "";
}

/** State-specific context the letter and interview draw on. */
export const STATE_CONTEXT: Record<AuState, { framework: string; teacherRegistration: string }> = {
  NSW: { framework: "EYLF V2.0 (and the NSW preschool funding context)", teacherRegistration: "NESA accreditation" },
  VIC: { framework: "VEYLDF alongside EYLF V2.0, including funded Three- and Four-Year-Old Kinder", teacherRegistration: "VIT registration" },
  QLD: { framework: "EYLF V2.0, and the QKLG for kindergarten programs", teacherRegistration: "QCT registration" },
  WA: { framework: "EYLF V2.0", teacherRegistration: "TRBWA registration" },
  SA: { framework: "EYLF V2.0", teacherRegistration: "Teachers Registration Board of SA registration" },
  TAS: { framework: "EYLF V2.0", teacherRegistration: "Teachers Registration Board of Tasmania registration" },
  ACT: { framework: "EYLF V2.0", teacherRegistration: "ACT Teacher Quality Institute registration" },
  NT: { framework: "EYLF V2.0", teacherRegistration: "Teacher Registration Board of the NT registration" },
};
