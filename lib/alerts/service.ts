import "server-only";
import { randomBytes } from "node:crypto";
import webpush from "web-push";
import type { FeedJob } from "../feed/types";
import { hashGetAll, hashSet, kvGet, kvSet } from "../kv";
import { describePrefs, jobMatches } from "./match";
import { EMPTY_PREFS, type AlertPrefs, type PushKeys, type Subscriber } from "./types";

// Job alerts: a daily email digest (like SEEK and Indeed) and instant push notifications.
// Email goes through Resend (RESEND_API_KEY, ALERTS_FROM_EMAIL); push uses Web Push with VAPID keys.

const KEY = "alerts:subscribers";
const PUSH_GAP_MS = 2 * 3600_000; // at most one push per person every two hours
const DIGEST_MAX_JOBS = 15;

export const appUrl = () => (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.ALERTS_FROM_EMAIL);
export const pushConfigured = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

const newToken = () => randomBytes(18).toString("base64url");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function loadSubscribers() {
  return hashGetAll<Subscriber>(KEY);
}

async function saveSubscriber(s: Subscriber) {
  await hashSet(KEY, { [s.id]: s });
}

export async function getSubscriber(id: string, token: string): Promise<Subscriber | null> {
  const s = (await loadSubscribers())[id];
  return s && s.token === token ? s : null;
}

function cleanPrefs(p: Partial<AlertPrefs> | undefined): AlertPrefs {
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 20) : []);
  return { states: list(p?.states), roleTypes: list(p?.roleTypes), employment: list(p?.employment), keywords: String(p?.keywords ?? "").slice(0, 200) };
}

/** Creates or updates someone's alerts. A new or changed email address must be confirmed. */
export async function upsertSubscriber(input: {
  id?: string;
  token?: string;
  email?: string | null;
  push?: PushKeys | null;
  prefs?: Partial<AlertPrefs>;
  locale?: string;
}, deps: { send?: typeof sendEmail } = {}): Promise<{ subscriber: Subscriber; confirmationSent: boolean }> {
  const existing = input.id && input.token ? await getSubscriber(input.id, input.token) : null;
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");

  const s: Subscriber = existing ?? {
    id: newToken().slice(0, 12),
    token: newToken(),
    email: null,
    emailStatus: "none",
    push: null,
    prefs: EMPTY_PREFS,
    locale: "en",
    createdAt: new Date().toISOString(),
    lastEmailAt: null,
    lastPushAt: null,
  };
  s.prefs = cleanPrefs(input.prefs ?? s.prefs);
  s.locale = input.locale || s.locale;
  if (input.push !== undefined) s.push = input.push;

  let confirmationSent = false;
  if (!email) {
    s.email = null;
    s.emailStatus = "none";
  } else if (email !== s.email || s.emailStatus === "unsubscribed" || s.emailStatus === "none") {
    s.email = email;
    s.emailStatus = "pending";
    if (emailConfigured()) {
      await (deps.send ?? sendEmail)({
        to: email,
        subject: "Confirm your Hire Me ECE job alerts",
        html: emailLayout(
          "Confirm your job alerts",
          `<p>You asked for a daily email when new early childhood jobs match: <b>${esc(describePrefs(s.prefs))}</b>.</p>
           <p style="margin:28px 0"><a href="${appUrl()}/api/alerts/confirm?id=${s.id}&token=${s.token}" style="background:#0f1f39;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:600">Yes, send me job alerts</a></p>
           <p>If you didn't ask for this, ignore this email and you won't hear from us again.</p>`,
          null,
        ),
        text: `Confirm your Hire Me ECE job alerts: ${appUrl()}/api/alerts/confirm?id=${s.id}&token=${s.token}`,
      });
      confirmationSent = true;
    }
  }
  await saveSubscriber(s);
  return { subscriber: s, confirmationSent };
}

export async function confirmEmail(id: string, token: string) {
  const s = await getSubscriber(id, token);
  if (!s || !s.email) return false;
  s.emailStatus = "active";
  s.lastEmailAt = new Date().toISOString(); // the first digest covers jobs from now on
  await saveSubscriber(s);
  return true;
}

export async function unsubscribe(id: string, token: string, what: "email" | "push" | "all" = "all") {
  const s = await getSubscriber(id, token);
  if (!s) return false;
  if (what !== "push" && s.email) s.emailStatus = "unsubscribed";
  if (what !== "email") s.push = null;
  await saveSubscriber(s);
  return true;
}

// ---------------------------------------------------------------- Sending

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; unsubscribeUrl?: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERTS_FROM_EMAIL,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: msg.unsubscribeUrl ? { "List-Unsubscribe": `<${msg.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Email service returned ${res.status}`);
}

type PushSender = (sub: PushKeys, payload: string) => Promise<unknown>;

const defaultPushSender: PushSender = (sub, payload) => {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:alerts@${new URL(appUrl()).hostname}`, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return webpush.sendNotification(sub, payload, { TTL: 12 * 3600 });
};

/** Sends an instant notification to everyone whose alerts match newly collected jobs. */
export async function notifyNewJobs(jobs: FeedJob[], deps: { push?: PushSender; now?: Date } = {}) {
  if (!jobs.length || (!pushConfigured() && !deps.push)) return 0;
  const now = deps.now ?? new Date();
  const send = deps.push ?? defaultPushSender;
  let sent = 0;
  for (const s of Object.values(await loadSubscribers())) {
    if (!s.push) continue;
    if (s.lastPushAt && now.getTime() - new Date(s.lastPushAt).getTime() < PUSH_GAP_MS) continue;
    const matches = jobs.filter((j) => jobMatches(j, s.prefs));
    if (!matches.length) continue;
    const payload = JSON.stringify({
      title: matches.length === 1 ? "New early childhood job for you" : `${matches.length} new early childhood jobs for you`,
      body: matches
        .slice(0, 2)
        .map((j) => `${j.title}${j.location ? ` · ${j.location}` : ""}`)
        .join("\n"),
      url: "/vacancies?new=1",
    });
    try {
      await send(s.push, payload);
      s.lastPushAt = now.toISOString();
      sent += 1;
    } catch (err) {
      // 404/410: the browser dropped the subscription.
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) s.push = null;
    }
    await saveSubscriber(s);
  }
  return sent;
}

/** Daily digest: each confirmed subscriber gets the matching jobs collected since their last email. */
export async function sendDigests(allJobs: FeedJob[], deps: { send?: typeof sendEmail; now?: Date } = {}) {
  if (!emailConfigured() && !deps.send) return 0;
  const now = deps.now ?? new Date();
  const send = deps.send ?? sendEmail;
  let sent = 0;
  for (const s of Object.values(await loadSubscribers())) {
    if (s.emailStatus !== "active" || !s.email) continue;
    const since = s.lastEmailAt ? new Date(s.lastEmailAt).getTime() : now.getTime() - 864e5;
    const matches = allJobs.filter((j) => new Date(j.collectedAt).getTime() > since && jobMatches(j, s.prefs));
    if (!matches.length) continue;
    const unsubscribeUrl = `${appUrl()}/api/alerts/unsubscribe?id=${s.id}&token=${s.token}&what=email`;
    const rows = matches
      .slice(0, DIGEST_MAX_JOBS)
      .map(
        (j) => `<tr><td style="padding:14px 0;border-bottom:1px solid #ebe7e0">
          <a href="${esc(j.url || `${appUrl()}/vacancies`)}" style="font-weight:600;color:#0f1f39;text-decoration:none;font-size:16px">${esc(j.title)}</a>
          <div style="color:#4b4951;font-size:14px;margin-top:2px">${esc([j.employer, j.location].filter(Boolean).join(" · "))}</div>
          <div style="color:#86662f;font-size:12px;margin-top:4px">${esc([j.roleLevel, j.salary, j.source].filter(Boolean).join(" · "))}</div>
        </td></tr>`,
      )
      .join("");
    try {
      await send({
        to: s.email,
        subject: `${matches.length} new early childhood job${matches.length === 1 ? "" : "s"} for you`,
        html: emailLayout(
          `${matches.length} new job${matches.length === 1 ? "" : "s"} matching your alerts`,
          `<p style="color:#4b4951">${esc(describePrefs(s.prefs))}</p>
           <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
           ${matches.length > DIGEST_MAX_JOBS ? `<p><a href="${appUrl()}/vacancies?new=1">See all ${matches.length} jobs</a></p>` : ""}`,
          unsubscribeUrl,
        ),
        text: matches.map((j) => `${j.title} — ${[j.employer, j.location].filter(Boolean).join(", ")}\n${j.url}`).join("\n\n") + `\n\nUnsubscribe: ${unsubscribeUrl}`,
        unsubscribeUrl,
      });
      s.lastEmailAt = now.toISOString();
      await saveSubscriber(s);
      sent += 1;
    } catch {
      // Try again tomorrow.
    }
  }
  await kvSet("alerts:lastDigestAt", now.toISOString());
  return sent;
}

export const lastDigestAt = () => kvGet<string>("alerts:lastDigestAt");

export function emailLayout(heading: string, body: string, unsubscribeUrl: string | null) {
  return `<!doctype html><html><body style="margin:0;background:#faf7ef;font-family:Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #ebe7e0;border-radius:6px">
    <tr><td style="background:#0f1f39;padding:20px 28px;font-family:Georgia,serif;font-size:22px;color:#fff">Hire Me <span style="color:#c79e57">ECE</span></td></tr>
    <tr><td style="padding:28px">
      <h1 style="font-family:Georgia,serif;font-weight:500;color:#0f1f39;font-size:26px;margin:0 0 12px">${esc(heading)}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:18px 28px;border-top:1px solid #ebe7e0;color:#8a8790;font-size:12px">
      You're receiving this because you signed up for job alerts at ${esc(new URL(appUrl()).hostname)}.
      ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#86662f">Unsubscribe</a> · ` : ""}<a href="${appUrl()}/vacancies" style="color:#86662f">Change your alerts</a>
    </td></tr>
  </table></td></tr></table></body></html>`;
}
