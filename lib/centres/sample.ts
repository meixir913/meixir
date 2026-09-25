import type { Service, SiteScan } from "./types";

// Shown only before the register has been imported, so the page can be explored. Centres are made up.
const at = new Date().toISOString();
export const SAMPLE_SITES: SiteScan[] = [
  { domain: "wattlegrove.example", homepage: "", name: "Wattle Grove Early Learning", states: ["NSW"], serviceCount: 4, status: "hiring", careersUrl: null, portal: null, jobTitles: ["Diploma Educator – Kindy Room", "Casual Cert III Educator"], checkedAt: at },
  { domain: "banksiakids.example", homepage: "", name: "Banksia Kids Preschool", states: ["VIC"], serviceCount: 1, status: "hiring", careersUrl: null, portal: "Workable", jobTitles: ["Early Childhood Teacher (ECT)"], checkedAt: at },
  { domain: "gumnuts.example", homepage: "", name: "Little Gumnuts Childcare", states: ["QLD"], serviceCount: 2, status: "portal", careersUrl: null, portal: "Employment Hero", jobTitles: [], checkedAt: at },
];

/** Made-up register entries for trying the centre search before the register is imported. */
export const SAMPLE_SERVICES: (Service & { domain: string | null })[] = [
  { id: "SE-1", name: "Wattle Grove Early Learning Parramatta", providerId: "PR-1", provider: "Wattle Grove Early Learning", type: "Centre-Based Care", address: "12 Church St", suburb: "Parramatta", state: "NSW", postcode: "2150", phone: "", places: 90, domain: "wattlegrove.example" },
  { id: "SE-2", name: "Wattle Grove Early Learning Blacktown", providerId: "PR-1", provider: "Wattle Grove Early Learning", type: "Centre-Based Care", address: "4 Main St", suburb: "Blacktown", state: "NSW", postcode: "2148", phone: "", places: 75, domain: "wattlegrove.example" },
  { id: "SE-3", name: "Banksia Kids Preschool", providerId: "PR-2", provider: "Banksia Kids Inc", type: "Centre-Based Care", address: "8 Beach Rd", suburb: "Brighton", state: "VIC", postcode: "3186", phone: "", places: 44, domain: "banksiakids.example" },
  { id: "SE-4", name: "Little Gumnuts Childcare", providerId: "PR-3", provider: "Little Gumnuts Pty Ltd", type: "Centre-Based Care", address: "21 Logan Rd", suburb: "Woolloongabba", state: "QLD", postcode: "4102", phone: "", places: 60, domain: "gumnuts.example" },
  { id: "SE-5", name: "Kookaburra Community Kindergarten", providerId: "PR-4", provider: "Kookaburra Kindergarten Association", type: "Centre-Based Care", address: "3 Park Lane", suburb: "Fitzroy", state: "VIC", postcode: "3065", phone: "", places: 33, domain: null },
];
