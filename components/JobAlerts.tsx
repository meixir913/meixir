"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellRing, Loader2, Mail, Smartphone } from "lucide-react";
import { describePrefs } from "@/lib/alerts/match";
import { EMPTY_PREFS, type AlertPrefs } from "@/lib/alerts/types";
import { AU_STATES, EMPLOYMENT_TYPES, ROLE_TYPES } from "@/lib/jobtypes";
import { useProfile, useStored } from "@/lib/storage";
import { Button, ChipToggle, Field, Input, Modal } from "./ui";

interface AlertConfig {
  email: boolean;
  push: boolean;
  vapidPublicKey: string | null;
}
interface SubscriberView {
  id: string;
  token: string;
  email: string | null;
  emailStatus: "none" | "pending" | "active" | "unsubscribed";
  push: boolean;
  prefs: AlertPrefs;
}

/** Remembers this browser's alert subscription (id + secret) and preferences. */
export function useAlertSubscription() {
  return useStored<{ id: string; token: string; prefs: AlertPrefs; email: boolean; push: boolean } | null>("hireme.alerts", null);
}

const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function subscribePush(vapidPublicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them for this site in your browser settings, then try again.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
  return sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
}

/** The "Get job alerts" button and its settings dialog. */
export default function JobAlerts({ variant = "primary", className = "" }: { variant?: "primary" | "secondary"; className?: string }) {
  const [profile] = useProfile();
  const [saved, setSaved] = useAlertSubscription();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [prefs, setPrefs] = useState<AlertPrefs>(EMPTY_PREFS);
  const [wantEmail, setWantEmail] = useState(true);
  const [email, setEmail] = useState("");
  const [wantPush, setWantPush] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<SubscriberView | null>(null);

  useEffect(() => {
    if (!open) return;
    const q = saved ? `?id=${saved.id}&token=${saved.token}` : "";
    fetch(`/api/alerts${q}`)
      .then((r) => r.json())
      .then((d: { config: AlertConfig; subscriber?: SubscriberView | null }) => {
        setConfig(d.config);
        const s = d.subscriber ?? null;
        setStatus(s);
        setPrefs(s?.prefs ?? saved?.prefs ?? { ...EMPTY_PREFS, states: profile.preferredStates, roleTypes: profile.preferredRoles, employment: profile.preferredEmployment });
        setEmail(s?.email ?? profile.email ?? "");
        setWantEmail(s ? s.emailStatus === "active" || s.emailStatus === "pending" : true);
        setWantPush(s ? s.push : false);
      })
      .catch(() => setConfig({ email: false, push: false, vapidPublicKey: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save() {
    setBusy(true);
    try {
      let push: { endpoint: string; keys: { p256dh: string; auth: string } } | null = null;
      if (wantPush && config?.vapidPublicKey) push = await subscribePush(config.vapidPublicKey);
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: saved?.id, token: saved?.token, email: wantEmail ? email : null, push, prefs, locale: document.documentElement.lang }),
      });
      const data = (await res.json()) as { error?: string; subscriber?: SubscriberView; confirmationSent?: boolean; emailConfigured?: boolean };
      if (!res.ok || !data.subscriber) throw new Error(data.error || "Couldn't save your alerts.");
      const s = data.subscriber;
      setSaved({ id: s.id, token: s.token, prefs, email: Boolean(s.email), push: s.push });
      setOpen(false);
      if (data.confirmationSent) toast.success("Check your inbox", { description: `We've sent a confirmation link to ${s.email}. Daily alerts start once you click it.` });
      else if (wantEmail && !data.emailConfigured) toast.success("Alerts saved", { description: "Email alerts will start once this site's email service is set up." });
      else toast.success("Job alerts updated", { description: describePrefs(prefs) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your alerts.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!saved) return;
    setBusy(true);
    await fetch("/api/alerts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: saved.id, token: saved.token }) }).catch(() => {});
    const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
    await (await reg?.pushManager.getSubscription())?.unsubscribe().catch(() => {});
    setSaved(null);
    setBusy(false);
    setOpen(false);
    toast("Job alerts turned off");
  }

  const on = Boolean(saved);
  const canPush = pushSupported() && Boolean(config?.push);

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} className={className}>
        {on ? <BellRing size={16} /> : <Bell size={16} />}
        {on ? "Job alerts on" : "Get job alerts"}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Job alerts">
        {!config ? (
          <p className="flex items-center gap-2 text-sm text-body">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-body">Tell us what you&apos;re looking for. We check for new early childhood jobs every morning and let you know when one matches.</p>
            <Field label="States" hint="none selected = all of Australia" group>
              <ChipToggle options={AU_STATES.map((s) => s.id)} titles={Object.fromEntries(AU_STATES.map((s) => [s.id, s.name]))} selected={prefs.states} onChange={(v) => setPrefs({ ...prefs, states: v })} />
            </Field>
            <Field label="Job types" hint="none selected = all" group>
              <ChipToggle options={ROLE_TYPES.filter((r) => r !== "Educator")} selected={prefs.roleTypes} onChange={(v) => setPrefs({ ...prefs, roleTypes: v })} />
            </Field>
            <Field label="Employment" hint="none selected = any" group>
              <ChipToggle options={[...EMPLOYMENT_TYPES]} selected={prefs.employment} onChange={(v) => setPrefs({ ...prefs, employment: v })} />
            </Field>
            <Field label="Suburbs or keywords" hint="optional, separate with commas">
              <Input value={prefs.keywords} onChange={(e) => setPrefs({ ...prefs, keywords: e.target.value })} placeholder="e.g. Parramatta, Blacktown, kindy" />
            </Field>

            <div className="space-y-3 rounded bg-cream p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-600">How should we tell you?</p>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={wantEmail} onChange={(e) => setWantEmail(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-500" />
                <span className="flex-1 text-sm">
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    <Mail size={15} /> Daily email
                  </span>
                  <span className="block text-slate-500">One email each morning with the new matching jobs. Unsubscribe any time.</span>
                  {wantEmail && <Input type="email" className="mt-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email for job alerts" />}
                  {status?.emailStatus === "pending" && <span className="mt-1 block text-xs text-gold-700">Waiting for you to confirm from the email we sent.</span>}
                </span>
              </label>
              <label className={`flex items-start gap-3 ${canPush ? "" : "opacity-60"}`}>
                <input type="checkbox" checked={wantPush} disabled={!canPush} onChange={(e) => setWantPush(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-500" />
                <span className="flex-1 text-sm">
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    <Smartphone size={15} /> Notifications on this device
                  </span>
                  <span className="block text-slate-500">
                    {canPush
                      ? "A pop-up as soon as a matching job is found. On iPhone, first add this site to your Home Screen (Share → Add to Home Screen)."
                      : !pushSupported()
                        ? "This browser doesn't support notifications. Try Chrome, Edge or Firefox, or add the site to your iPhone's Home Screen."
                        : "Notifications aren't set up on this site yet."}
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {on ? (
                <button type="button" onClick={turnOff} disabled={busy} className="text-sm font-semibold text-rose-700 underline-offset-2 hover:underline">
                  Turn off alerts
                </button>
              ) : (
                <span />
              )}
              <Button onClick={save} disabled={busy || (!wantEmail && !wantPush) || (wantEmail && !email.trim())}>
                {busy && <Loader2 size={15} className="animate-spin" />}
                {on ? "Update alerts" : "Turn on alerts"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
