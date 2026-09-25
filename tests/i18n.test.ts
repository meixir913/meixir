import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/messages";

// Every interface string passed to t(), <Rich text> or a page heading must be translated in every language.

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === "api" ? [] : files(p);
    return p.endsWith(".tsx") ? [p] : [];
  });
}

const NOT_TRANSLATED = new Set(["ECE", "you@example.com", "wattlegrove.com.au", "https://…", "Parramatta", "Parramatta NSW", "Wattle Grove Early Learning", "Little Sprouts Early Learning Centre", "Sunny Days Early Learning", "Alex", "$32–$36/hour"]);

function uiStrings() {
  const keys = new Set<string>();
  for (const f of [...files("app"), ...files("components")]) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(m[1].replace(/\\"/g, '"'));
    for (const m of src.matchAll(/(?:<Rich text|heading)="((?:[^"\\]|\\.)*)"/g)) keys.add(m[1].replace(/\\"/g, '"'));
  }
  return [...keys].filter((k) => /[A-Za-z]/.test(k) && !NOT_TRANSLATED.has(k));
}

const placeholders = (s: string) => (s.match(/\{\w+\}|<\/?(?:b|em|code)>/g) ?? []).sort();

describe("translations", () => {
  const keys = uiStrings();

  it("finds the interface strings", () => {
    expect(keys.length).toBeGreaterThan(300);
  });

  for (const [locale, messages] of Object.entries(MESSAGES)) {
    it(`${locale} covers every string and keeps placeholders and formatting`, () => {
      const missing = keys.filter((k) => !(k in messages));
      expect(missing).toEqual([]);
      const broken = Object.entries(messages).filter(([k, v]) => placeholders(k).join() !== placeholders(v).join());
      expect(broken).toEqual([]);
    });
  }
});
