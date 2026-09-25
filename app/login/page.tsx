"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthLayout, { FormError, FormNotice, SocialLogin, safeNext, useAuthForm } from "@/components/AuthLayout";
import { Button, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n";

function LoginForm() {
  const t = useT();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const created = params.get("created") === "1";
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  // Just signed up: start on My Profile, where the resume goes.
  const { busy, error, submit } = useAuthForm("/api/auth/login", () => window.location.assign(created && next === "/" ? "/profile?welcome=1" : next));
  const oauthError = params.get("error");
  const provider = params.get("provider") === "facebook" ? "Facebook" : "Google";
  const linkError =
    oauthError === "oauth-not-configured" ? t("Signing in with {provider} isn't set up yet. Use your email and password for now.", { provider }) : oauthError ? t(oauthError) : "";

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
      <FormNotice message={created ? t("Your account has been created. Log in to get started.") : ""} />
      {linkError && (
        <div className="mb-6">
          <FormError message={linkError} />
        </div>
      )}
      <SocialLogin next={next} />
      <form onSubmit={submit({ email, password })} className="space-y-5">
        <Field label={t("Email")}>
          <Input type="email" autoComplete="email" required autoFocus={!created} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div>
          <Field label={t("Password")}>
            <Input type="password" autoComplete="current-password" required autoFocus={created} value={password} onChange={(e) => setPassword(e.target.value)} />
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
