"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthLayout, { FormError, safeNext, useAuthForm } from "@/components/AuthLayout";
import { Button, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n";

function LoginForm() {
  const t = useT();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, submit } = useAuthForm("/api/auth/login", () => window.location.assign(next));

  return (
    <AuthLayout
      heading="Welcome <em>back</em>"
      subtitle={t("Log in to see today's jobs, your applications and your saved letters.")}
      footer={
        <>
          {t("New to Hire Me ECE?")}{" "}
          <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-gold-700 underline-offset-4 hover:underline">
            {t("Create a free account")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit({ email, password })} className="space-y-5">
        <Field label={t("Email")}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div>
          <Field label={t("Password")}>
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Link href="/forgot-password" className="mt-2 inline-block text-sm text-gold-700 underline-offset-4 hover:underline">
            {t("Forgot your password?")}
          </Link>
        </div>
        <FormError message={error} />
        <Button type="submit" disabled={busy} className="w-full py-3">
          {busy ? t("Logging in…") : t("Log in")}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
