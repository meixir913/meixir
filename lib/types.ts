export type JobStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";

export interface Job {
  id: string;
  title: string;
  centre: string;
  location: string;
  salary: string;
  url: string;
  description: string;
  /** What the centre says about itself: programs, philosophy, values. */
  centreInfo: string;
  philosophies: string[];
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
};
