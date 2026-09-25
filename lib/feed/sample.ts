import type { FeedJob } from "./types";

// Shown only while the feed is empty and no sources are connected, so the page can be explored.
// Centres below are made up.
const day = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

type SampleInput = Omit<FeedJob, "id" | "collectedAt" | "description"> & { description?: string };

const s = (j: SampleInput, i: number): FeedJob => ({
  id: `sample-${i}`,
  collectedAt: j.postedAt,
  description: j.description ?? "Sample listing. Connect a source to see real jobs.",
  ...j,
});

const SAMPLES: SampleInput[] = [
  { title: "Diploma Qualified Educator – Kindy Room", employer: "Wattle Grove Early Learning", location: "Parramatta NSW", state: "NSW", salary: "$32 – $35/hr", employmentType: "full time", roleLevel: "Diploma Educator", url: "", sourceKind: "job-board", source: "Adzuna", postedAt: day(0) },
  { title: "Early Childhood Teacher (ECT) – Preschool", employer: "Banksia Kids Preschool", location: "Brunswick VIC", state: "VIC", salary: "$85k – $98k", employmentType: "permanent", roleLevel: "Early Childhood Teacher", url: "", sourceKind: "provider", source: "Provider careers", postedAt: day(0) },
  { title: "Casual Cert III Educators needed ASAP", employer: "Little Gumnuts Childcare", location: "Logan QLD", state: "QLD", salary: "$29/hr", employmentType: "casual", roleLevel: "Educator (Cert III)", url: "", sourceKind: "community", source: "Facebook group", postedAt: day(1) },
  { title: "Room Leader – Toddlers", employer: "Seaside Early Learning", location: "Scarborough WA", state: "WA", salary: "", employmentType: "full time", roleLevel: "Room / Educational Leader", url: "", sourceKind: "email-alert", source: "SEEK alert", postedAt: day(1) },
  { title: "Centre Director", employer: "Kookaburra Learning Centre", location: "Belconnen ACT", state: "ACT", salary: "$105k + bonus", employmentType: "full time", roleLevel: "Centre Director", url: "", sourceKind: "job-board", source: "Jooble · Indeed", postedAt: day(2) },
  { title: "OSHC Educator – Before & After School Care", employer: "Riverbend OSHC", location: "Norwood SA", state: "SA", salary: "$30/hr", employmentType: "part time", roleLevel: "OSHC", url: "", sourceKind: "job-board", source: "Adzuna", postedAt: day(3) },
];

export const SAMPLE_JOBS: FeedJob[] = SAMPLES.map(s);
