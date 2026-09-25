import { detectState } from "../feed/classify";
import type { AuState } from "../feed/types";
import type { Service } from "./types";

// ACECQA publishes the national register of approved services as one CSV per state, refreshed daily.
// https://www.acecqa.gov.au/resources/national-registers

export const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"] as const;

export const registerUrl = (state: string) =>
  `https://www.acecqa.gov.au/sites/default/files/national-registers/services/Education-services-${state}-export.csv`;

/** Parses CSV text, including quoted fields with commas, quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

// Header names vary slightly between exports ("ServiceName" vs "Service Name"), so match loosely.
const COLUMNS: Record<keyof Omit<Service, "places">, string[]> & { places: string[] } = {
  id: ["serviceapprovalnumber", "serviceid", "serviceapprovalno"],
  name: ["servicename"],
  providerId: ["providerapprovalnumber", "providerid", "providerapprovalno"],
  provider: ["providerlegalname", "providername", "approvedprovider"],
  type: ["servicetype"],
  address: ["serviceaddress", "address", "addressline1"],
  suburb: ["suburb", "servicesuburb", "town"],
  state: ["state", "servicestate"],
  postcode: ["postcode", "servicepostcode"],
  phone: ["phone", "servicephone", "phonenumber"],
  places: ["numberofapprovedplaces", "approvedplaces", "maximumnumberofchildren", "placesapproved"],
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

export function parseRegister(csv: string): Service[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return [];
  const heads = header.map(norm);
  const col = (names: string[]) => heads.findIndex((h) => names.includes(h));
  const idx = Object.fromEntries(Object.entries(COLUMNS).map(([k, names]) => [k, col(names)])) as Record<keyof Service, number>;
  if (idx.id < 0 || idx.name < 0) throw new Error("The ACECQA register format has changed: no service number or name column found.");

  const get = (row: string[], k: keyof Service) => (idx[k] >= 0 ? (row[idx[k]] ?? "").trim() : "");
  return rows
    .map((row) => {
      const state = get(row, "state").toUpperCase();
      const places = Number.parseInt(get(row, "places"), 10);
      return {
        id: get(row, "id"),
        name: get(row, "name"),
        providerId: get(row, "providerId") || get(row, "provider"),
        provider: get(row, "provider"),
        type: get(row, "type"),
        address: get(row, "address"),
        suburb: get(row, "suburb"),
        state: ((["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].includes(state) ? state : detectState(state)) ?? "") as AuState | "",
        postcode: get(row, "postcode"),
        phone: get(row, "phone"),
        places: Number.isFinite(places) ? places : null,
      };
    })
    .filter((s) => s.id && s.name);
}

export async function downloadRegister(fetcher: typeof fetch = fetch): Promise<Service[]> {
  const all: Service[] = [];
  for (const state of STATES) {
    const res = await fetcher(registerUrl(state), { headers: { "User-Agent": "HireMeECE-CentreScanner/1.0 (+https://hiremeece.au)" } });
    if (!res.ok) throw new Error(`ACECQA register for ${state.toUpperCase()} returned ${res.status}`);
    all.push(...parseRegister(await res.text()));
  }
  return all;
}
