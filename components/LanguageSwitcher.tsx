"use client";

import { Languages } from "lucide-react";
import { LOCALES, useI18n, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={`flex items-center gap-2 text-sm text-ink ${className}`}>
      <Languages size={16} className="shrink-0 text-gold-600" aria-hidden />
      <span className="sr-only">{t("Language")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="w-full cursor-pointer rounded border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-gold-500"
      >
        {LOCALES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
