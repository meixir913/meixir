import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Fetches a web page from a URL a visitor typed in (e.g. a centre's website), refusing anything that
// points inside our own network: localhost, private ranges, link-local and metadata addresses.

function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim().match(/^https?:\/\//i) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new Error("That doesn't look like a website address.");
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Only normal http(s) website addresses are supported.");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(url.hostname)) throw new Error("That address isn't a public website.");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw new Error("Couldn't find that website. Check the address.");
  if (addresses.some((a) => privateAddress(a.address))) throw new Error("That address isn't a public website.");
  return url;
}

/** GETs a public page as text, following up to 3 redirects (each re-checked). */
export async function fetchPublicPage(raw: string, timeoutMs = 10_000): Promise<{ url: string; html: string }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": "HireMeECE/1.0 (+https://hiremeece.au)", Accept: "text/html" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
        continue;
      }
      if (!res.ok) throw new Error(`The website answered with an error (${res.status}).`);
      return { url: url.toString(), html: (await res.text()).slice(0, 1_500_000) };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw new Error("The website took too long to respond.");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("The website redirected too many times.");
}
