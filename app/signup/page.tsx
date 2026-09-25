"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthLayout, { FormError, SocialLogin, safeNext, useAuthForm } from "@/components/AuthLayout";
import { Button, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n";

function SignupForm() {
  const t = useT();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The account is created signed out; the log-in page confirms it and asks them to log in.
  const { busy, error, submit } = useAuthForm<{ email: string }>("/api/auth/signup", (d) => {
    const q = new URLSearchParams({ created: "1", email: d.email, ...(next !== "/" ? { next } : {}) });
    window.location.assign(`/login?${q}`);
  });

  return (
    <AuthLayout
      heading="Create your <em>account</em>"
      subtitle={t("Save jobs, resumes and cover letters in one place, on any device.")}
      footer={
        <>
          {t("Already have an account?")}{" "}
          <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-gold-700 underline-offset-4 hover:underline">
            {t("Log in")}
          </Link>
        </>
      }
    >
      <SocialLogin next={next} />
      <form onSubmit={submit({ name, email, password })} className="space-y-5">
        <Field label={t("Full name")}>
          <Input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("Email")}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t("Password")} hint={t("At least 8 characters")}>
          <Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError message={error} />
        <Button type="submit" disabled={busy} className="w-full py-3">
          {busy ? t("Creating your account…") : t("Create account")}
        </Button>
        <p className="text-xs leading-relaxed text-slate-500">{t("By creating an account you agree to Hire Me ECE storing your resume and applications so the dashboard can use them. You can delete them at any time.")}</p>
      </form>
    </AuthLayout>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
