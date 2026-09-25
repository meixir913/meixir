"use client";

import Link from "next/link";
import { Eyebrow } from "@/components/ui";
import { Rich, useT } from "@/lib/i18n";

export default function NotFound() {
  const t = useT();
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <Eyebrow className="justify-center">{t("Page not found")}</Eyebrow>
      <h1 className="mt-4 text-5xl font-medium">
        <Rich text="This page has <em>moved on</em>" />
      </h1>
      <p className="mt-4 text-body">{t("The link may be old or mistyped. Head back to your dashboard to keep going.")}</p>
      <Link href="/" className="mt-8 inline-flex rounded bg-brand-500 px-6 py-3 text-sm font-semibold tracking-wide text-white hover:bg-brand-600">
        {t("Back to dashboard")}
      </Link>
    </div>
  );
}
