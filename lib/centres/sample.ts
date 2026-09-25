import type { SiteScan } from "./types";

// Shown only before the register has been imported, so the page can be explored. Centres are made up.
const at = new Date().toISOString();
export const SAMPLE_SITES: SiteScan[] = [
  { domain: "wattlegrove.example", homepage: "", name: "Wattle Grove Early Learning", states: ["NSW"], serviceCount: 4, status: "hiring", careersUrl: null, portal: null, jobTitles: ["Diploma Educator – Kindy Room", "Casual Cert III Educator"], checkedAt: at },
  { domain: "banksiakids.example", homepage: "", name: "Banksia Kids Preschool", states: ["VIC"], serviceCount: 1, status: "hiring", careersUrl: null, portal: "Workable", jobTitles: ["Early Childhood Teacher (ECT)"], checkedAt: at },
  { domain: "gumnuts.example", homepage: "", name: "Little Gumnuts Childcare", states: ["QLD"], serviceCount: 2, status: "portal", careersUrl: null, portal: "Employment Hero", jobTitles: [], checkedAt: at },
];
