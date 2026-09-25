"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import AuthLayout, { FormError, useAuthForm } from "@/components/AuthLayout";
import { Button, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, submit } = useAuthForm("/api/auth/forgot", () => setSent(true));

  return (
    <AuthLayout
      heading="Reset your <em>password</em>"
      subtitle={sent ? undefined : t("Enter the email you signed up with and we'll send you a link to choose a new password.")}
      footer={
        <Link href="/login" className="font-semibold text-gold-700 underline-offset-4 hover:underline">
          {t("Back to log in")}
        </Link>
      }
    >
      {sent ? (
        <div className="flex gap-3 rounded-md border border-line bg-white p-5">
          <MailCheck className="shrink-0 text-gold-600" />
          <p className="text-sm leading-relaxed text-body">{t("If an account exists for {email}, a reset link is on its way. The link works for one hour.", { email })}</p>
        </div>
      ) : (
        <form onSubmit={submit({ email })} className="space-y-5">
          <Field label={t("Email")}>
            <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <FormError message={error} />
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? t("Sending…") : t("Send reset link")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
