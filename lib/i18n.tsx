"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { MESSAGES } from "./messages";

// Interface translations. English text is the key, so untranslated strings simply show in English.
// Cover letters and interview rehearsal stay in English: Australian centres hire in English.

export const LOCALES = [
  { id: "en", label: "English" },
  { id: "zh", label: "简体中文" },
  { id: "vi", label: "Tiếng Việt" },
  { id: "ne", label: "नेपाली" },
  { id: "hi", label: "हिन्दी" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];
const STORAGE_KEY = "hireme.locale";

type Vars = Record<string, string | number>;
export type Translate = (text: string, vars?: Vars) => string;

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

const I18nContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void; t: Translate }>({
  locale: "en",
  setLocale: () => {},
  t: fill,
});

function initialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && LOCALES.some((l) => l.id === saved)) return saved;
  } catch {
    // Storage blocked: fall back to the browser language.
  }
  const browser = navigator.language.slice(0, 2);
  return (LOCALES.find((l) => l.id === browser)?.id ?? "en") as Locale;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => setLocaleState(initialLocale()), []);
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en-AU" : locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Not remembered this time; still switches.
    }
  }, []);

  const t = useCallback<Translate>((text, vars) => fill(locale === "en" ? text : (MESSAGES[locale]?.[text] ?? text), vars), [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;

/**
 * Translates a whole sentence that contains simple formatting, e.g.
 * <Rich text="These are <b>sample jobs</b>." />. Supports <b>, <em> and <code>.
 */
export function Rich({ text, vars }: { text: string; vars?: Vars }) {
  const t = useT();
  const parts = t(text, vars).split(/(<(?:b|em|code)>[\s\S]*?<\/(?:b|em|code)>)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^<(b|em|code)>([\s\S]*)<\/\1>$/);
        if (!m) return part;
        if (m[1] === "b") return <b key={i}>{m[2]}</b>;
        if (m[1] === "em") return <em key={i} className="text-gold-500">{m[2]}</em>;
        return (
          <code key={i} className="rounded bg-gold-100 px-1">
            {m[2]}
          </code>
        );
      })}
    </>
  );
}
