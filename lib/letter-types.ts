// Shapes shared by the Cover Letter page and its API routes.

export interface CentreDetails {
  name: string;
  suburb: string;
  state: string;
  website: string;
  /** Frameworks and how learning is planned (EYLF V2.0, VEYLDF, intentional teaching, project work…). */
  curriculum: string;
  /** The centre's philosophy, ideally in its own words. */
  philosophy: string;
  /** Programs offered (rooms, funded kinder, bush kinder, languages, school readiness, OSHC…). */
  programs: string;
  /** Named pedagogical approaches, e.g. Reggio Emilia. */
  approaches: string[];
}

/** What /api/centre-profile returns, and where the details came from. */
export type CentreProfileResponse = CentreDetails & { source: "website" | "ad" | "none"; pagesRead?: number; note?: string };

export interface RoleDetails {
  title: string;
  roleType: string;
  employmentType: string;
  description: string;
}

export type AlignmentCategory = "curriculum" | "philosophy" | "program" | "role";
export type AlignmentStrength = "strong" | "partial" | "gap";

export interface AlignmentItem {
  category: AlignmentCategory;
  /** What the centre values or needs, in a few words. */
  centreElement: string;
  /** Evidence from the candidate's resume or profile ("" for a gap). */
  evidence: string;
  strength: AlignmentStrength;
  /** How to present it in the letter; for a gap, an honest way to address it or leave it out. */
  framing: string;
}

export interface Alignment {
  summary: string;
  items: AlignmentItem[];
}

/** What reading a resume returns: profile fields to fill in, plus the resume as clean text. */
export interface ResumeExtract {
  name: string;
  email: string;
  phone: string;
  city: string;
  credential: string;
  registrationNumber: string;
  yearsExperience: string;
  ageGroups: string[];
  certifications: string;
  strengths: string;
  personalPhilosophy: string;
  resumeText: string;
}

export const EMPTY_CENTRE: CentreDetails = { name: "", suburb: "", state: "", website: "", curriculum: "", philosophy: "", programs: "", approaches: [] };
export const EMPTY_ROLE: RoleDetails = { title: "", roleType: "", employmentType: "", description: "" };
