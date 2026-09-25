import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobMatches } from "@/lib/alerts/match";
import { confirmEmail, loadSubscribers, notifyNewJobs, sendDigests, unsubscribe, upsertSubscriber } from "@/lib/alerts/service";
import { EMPTY_PREFS } from "@/lib/alerts/types";
import type { FeedJob } from "@/lib/feed/types";

const job = (over: Partial<FeedJob> = {}): FeedJob => ({
  id: Math.random().toString(36).slice(2),
  title: "Diploma Educator",
  employer: "Wattle Grove Early Learning",
  location: "Parramatta NSW",
  state: "NSW",
  salary: "$34/hr",
  employmentType: "full time",
  roleLevel: "Diploma Educator",
  url: "https://example.com/1",
  description: "",
  sourceKind: "job-board",
  source: "Adzuna",
  postedAt: new Date().toISOString(),
  collectedAt: new Date().toISOString(),
  ...over,
});

const push = { endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } };

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "alerts-"));
});

describe("matching", () => {
  it("filters by state, job type, employment and keywords", () => {
    expect(jobMatches(job(), EMPTY_PREFS)).toBe(true);
    expect(jobMatches(job(), { ...EMPTY_PREFS, states: ["VIC"] })).toBe(false);
    expect(jobMatches(job(), { ...EMPTY_PREFS, states: ["NSW", "VIC"], roleTypes: ["Diploma Educator"] })).toBe(true);
    expect(jobMatches(job(), { ...EMPTY_PREFS, roleTypes: ["Early Childhood Teacher"] })).toBe(false);
    expect(jobMatches(job({ employmentType: "Casual" }), { ...EMPTY_PREFS, employment: ["Full time"] })).toBe(false);
    expect(jobMatches(job(), { ...EMPTY_PREFS, keywords: "blacktown, parramatta" })).toBe(true);
    expect(jobMatches(job(), { ...EMPTY_PREFS, keywords: "blacktown" })).toBe(false);
  });
});

describe("email alerts", () => {
  it("sends only after the address is confirmed, then digests new matches and honours unsubscribe", async () => {
    process.env.RESEND_API_KEY = "test";
    process.env.ALERTS_FROM_EMAIL = "Hire Me ECE <alerts@hiremeece.au>";
    const send = vi.fn(async () => {});
    const { subscriber, confirmationSent } = await upsertSubscriber({ email: "Sam@Example.com", prefs: { ...EMPTY_PREFS, states: ["NSW"] } }, { send });
    expect(confirmationSent).toBe(true);
    expect(subscriber).toMatchObject({ email: "sam@example.com", emailStatus: "pending" });
    expect(send.mock.calls[0][0]).toMatchObject({ to: "sam@example.com", subject: expect.stringContaining("Confirm") });

    // Not confirmed yet: no digest.
    expect(await sendDigests([job()], { send })).toBe(0);

    expect(await confirmEmail(subscriber.id, subscriber.token)).toBe(true);
    const later = new Date(Date.now() + 60_000);
    const fresh = [job({ collectedAt: later.toISOString() }), job({ state: "VIC", collectedAt: later.toISOString() })];
    expect(await sendDigests(fresh, { send, now: new Date(later.getTime() + 1000) })).toBe(1);
    const digest = send.mock.calls[1][0] as unknown as { subject: string; html: string; unsubscribeUrl: string };
    expect(digest.subject).toBe("1 new early childhood job for you");
    expect(digest.html).toContain("Wattle Grove Early Learning");
    expect(digest.unsubscribeUrl).toContain(`id=${subscriber.id}`);

    // Nothing new since the last email: no second digest.
    expect(await sendDigests(fresh, { send, now: new Date(later.getTime() + 2000) })).toBe(0);

    expect(await unsubscribe(subscriber.id, subscriber.token, "email")).toBe(true);
    expect((await loadSubscribers())[subscriber.id].emailStatus).toBe("unsubscribed");
    expect(await unsubscribe(subscriber.id, "wrong-token")).toBe(false);
    delete process.env.RESEND_API_KEY;
  });

  it("rejects an invalid email address", async () => {
    await expect(upsertSubscriber({ email: "not-an-email" })).rejects.toThrow("valid email");
  });
});

describe("push alerts", () => {
  it("notifies matching devices, at most every two hours, and drops expired ones", async () => {
    const a = (await upsertSubscriber({ push, prefs: { ...EMPTY_PREFS, roleTypes: ["Diploma Educator"] } })).subscriber;
    const b = (await upsertSubscriber({ push: { ...push, endpoint: "https://push.example/gone" }, prefs: EMPTY_PREFS })).subscriber;
    await upsertSubscriber({ push: { ...push, endpoint: "https://push.example/other" }, prefs: { ...EMPTY_PREFS, states: ["WA"] } });

    const sent: string[] = [];
    const sender = vi.fn(async (sub: { endpoint: string }, payload: string) => {
      if (sub.endpoint.endsWith("gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      sent.push(payload);
    });
    const now = new Date();
    expect(await notifyNewJobs([job(), job({ title: "Room Leader", roleLevel: "Room / Educational Leader" })], { push: sender, now })).toBe(1);
    expect(JSON.parse(sent[0])).toMatchObject({ title: "New early childhood job for you", url: "/vacancies?new=1" });
    expect((await loadSubscribers())[b.id].push).toBeNull();

    // Within two hours: no second notification.
    expect(await notifyNewJobs([job()], { push: sender, now: new Date(now.getTime() + 3600_000) })).toBe(0);
    expect(await notifyNewJobs([job()], { push: sender, now: new Date(now.getTime() + 3 * 3600_000) })).toBe(1);
    expect((await loadSubscribers())[a.id].lastPushAt).not.toBeNull();
  });
});
