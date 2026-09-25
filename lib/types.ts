export type JobStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";

export interface Job {
  id: string;
  title: string;
  centre: string;
  location: string;
  salary: string;
  url: string;
  description: string;
  /** Anything else known about the centre (general notes, values). */
  centreInfo: string;
  /** Pedagogical approaches, e.g. Reggio Emilia, bush kinder. */
  philosophies: string[];
  state: string;
  roleType: string;
  employmentType: string;
  /** How the centre plans learning: frameworks, curriculum approach. */
  centreCurriculum: string;
  /** The centre's philosophy in its own words. */
  centrePhilosophy: string;
  /** Programs offered: rooms, kinder, bush kinder, languages, OSHC. */
  centrePrograms: string;
  /** The centre's own website, used to read its philosophy and programs. */
  website: string;
  status: JobStatus;
  notes: string;
  interviewDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
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
  resume: string;
  resumeFileName: string;
  preferredStates: string[];
  preferredRoles: string[];
  preferredEmployment: string[];
  /** Which saved resume letters and interviews use by default. */
  defaultResumeId: string;
}

/** A resume saved to My Profile. People keep several (e.g. one for ECT roles, one for leadership roles). */
export interface Resume {
  id: string;
  /** A name the person recognises, e.g. "ECT resume 2026". Starts as the file name. */
  label: string;
  fileName: string;
  text: string;
  uploadedAt: string;
}

export interface CoverLetter {
  id: string;
  jobId: string | null;
  title: string;
  centre: string;
  content: string;
  createdAt: string;
}

export interface InterviewTurn {
  role: "interviewer" | "candidate";
  text: string;
}

export interface InterviewFeedback {
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  perQuestion: {
    question: string;
    score: number;
    feedback: string;
    strongerAnswer: string;
  }[];
}

export interface InterviewSession {
  id: string;
  jobId: string | null;
  role: string;
  centre: string;
  turns: InterviewTurn[];
  feedback: InterviewFeedback | null;
  createdAt: string;
}

export const EMPTY_PROFILE: Profile = {
  name: "",
  email: "",
  phone: "",
  city: "",
  credential: "",
  registrationNumber: "",
  yearsExperience: "",
  ageGroups: [],
  certifications: "",
  strengths: "",
  personalPhilosophy: "",
  resume: "",
  resumeFileName: "",
  preferredStates: [],
  preferredRoles: [],
  preferredEmployment: [],
  defaultResumeId: "",
};

/** Defaults for job fields added in later versions. */
export const EMPTY_JOB_FIELDS: Pick<Job, "state" | "roleType" | "employmentType" | "centreCurriculum" | "centrePhilosophy" | "centrePrograms" | "philosophies" | "centreInfo" | "website"> = {
  state: "",
  roleType: "",
  employmentType: "",
  centreCurriculum: "",
  centrePhilosophy: "",
  centrePrograms: "",
  philosophies: [],
  centreInfo: "",
  website: "",
};
