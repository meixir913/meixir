"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthLayout, { FormError, useAuthForm } from "@/components/AuthLayout";
import { Button, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n";

function ResetForm() {
  const t = useT();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const { busy, error, submit } = useAuthForm("/api/auth/reset", () => window.location.assign("/"));

  return (
    <AuthLayout
      heading="Choose a new <em>password</em>"
      footer={
        <Link href="/forgot-password" className="font-semibold text-gold-700 underline-offset-4 hover:underline">
          {t("Ask for a new link")}
        </Link>
      }
    >
      <form onSubmit={submit({ token, password })} className="space-y-5">
        <Field label={t("New password")} hint={t("At least 8 characters")}>
          <Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError message={error} />
        <Button type="submit" disabled={busy || !token} className="w-full py-3">
          {busy ? t("Saving…") : t("Save and log in")}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
