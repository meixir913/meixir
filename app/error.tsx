"use client";

import { Button, Eyebrow } from "@/components/ui";
import { Rich, useT } from "@/lib/i18n";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <Eyebrow className="justify-center">{t("Something went wrong")}</Eyebrow>
      <h1 className="mt-4 text-5xl font-medium">
        <Rich text="That didn't <em>load</em>" />
      </h1>
      <p className="mt-4 text-body">{t("Your saved jobs, letters and profile are safe in this browser. Try again, and if it keeps happening, refresh the page.")}</p>
      <Button onClick={reset} className="mt-8 px-6 py-3">
        {t("Try again")}
      </Button>
    </div>
  );
}
