/** Language names for AI instructions, keyed by interface locale. */
const NAMES: Record<string, string> = { zh: "Simplified Chinese", vi: "Vietnamese", ne: "Nepali", hi: "Hindi" };

/** An instruction to explain in the reader's language, or "" for English. */
export function languageNote(locale: string | undefined, keepEnglish: string): string {
  const name = locale ? NAMES[locale] : undefined;
  return name ? `Write your explanations for the candidate in ${name}. Keep ${keepEnglish} in English, because Australian centres hire in English.` : "";
}
