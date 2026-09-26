import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthError, createResetToken, createSession, createUser, endSession, resetPassword, tokenFromRequest, userFromSession, verifyLogin } from "@/lib/auth";
import { GET as searchCentres } from "@/app/api/centres/search/route";

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "auth-"));
});

describe("accounts", () => {
  it("signs up, logs in and rejects a wrong password", async () => {
    const user = await createUser({ name: "Priya Sharma", email: "Priya@Example.com ", password: "correct horse" });
    expect(user.email).toBe("priya@example.com");
    expect(user.passwordHash).not.toContain("correct");
    expect((await verifyLogin("priya@example.com", "correct horse"))?.id).toBe(user.id);
    expect(await verifyLogin("priya@example.com", "wrong password")).toBeNull();
    expect(await verifyLogin("nobody@example.com", "correct horse")).toBeNull();
  });

  it("refuses duplicate emails, bad emails and short passwords", async () => {
    await createUser({ name: "A", email: "a@example.com", password: "12345678" });
    await expect(createUser({ name: "A", email: "A@example.com", password: "12345678" })).rejects.toThrow(AuthError);
    await expect(createUser({ name: "B", email: "not-an-email", password: "12345678" })).rejects.toThrow(/valid email/);
    await expect(createUser({ name: "C", email: "c@example.com", password: "short" })).rejects.toThrow(/8 characters/);
  });

  it("keeps sessions until log out", async () => {
    const user = await createUser({ name: "A", email: "a@example.com", password: "12345678" });
    const { token } = await createSession(user.id);
    const req = new Request("http://x/", { headers: { cookie: `other=1; hm_session=${token}` } });
    expect(tokenFromRequest(req)).toBe(token);
    expect((await userFromSession(token))?.id).toBe(user.id);
    await endSession(token);
    expect(await userFromSession(token)).toBeNull();
    expect(await userFromSession("made-up")).toBeNull();
  });

  it("resets a password once per link", async () => {
    const user = await createUser({ name: "A", email: "a@example.com", password: "old password" });
    const token = await createResetToken(user.id);
    await resetPassword(token, "new password");
    expect(await verifyLogin("a@example.com", "new password")).not.toBeNull();
    expect(await verifyLogin("a@example.com", "old password")).toBeNull();
    await expect(resetPassword(token, "another one")).rejects.toThrow(/expired/);
  });
});

describe("centre search", () => {
  const search = async (q: string, state = "") => (await searchCentres(new Request(`http://x/api/centres/search?${new URLSearchParams({ q, state })}`))).json();

  it("searches the real ACECQA register by suburb, postcode and name, with scan results", async () => {
    const byPostcode = await search("3186");
    expect(byPostcode.sample).toBe(false);
    expect(byPostcode.total).toBeGreaterThan(5);
    expect(byPostcode.results.every((r: { postcode: string; state: string }) => r.postcode === "3186" && r.state === "VIC")).toBe(true);
    const inWa = await search("early learning", "WA");
    expect(inWa.results.every((r: { state: string }) => r.state === "WA")).toBe(true);
    // Centres that are hiring come first.
    const statuses = (await search("oshc")).results.map((r: { status: string | null }) => r.status);
    expect(statuses.indexOf("hiring")).toBe(statuses.includes("hiring") ? 0 : -1);
    expect((await search("zzzz-no-such-centre")).total).toBe(0);
  });
});

describe("Google and Facebook sign-in", () => {
  it("checks the state, reads the Google profile and links it to the account with that email", async () => {
    const { startOAuth, finishOAuth, userForOAuth } = await import("@/lib/oauth");
    process.env.GOOGLE_CLIENT_ID = "cid";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    const existing = await createUser({ name: "Priya", email: "priya@example.com", password: "12345678" });

    const start = await startOAuth("google", new Request("http://localhost:3000/api/auth/oauth/google"), "/letters");
    expect(start.url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Foauth%2Fgoogle%2Fcallback");

    const fetcher = (async (url: string | URL) =>
      String(url).includes("token")
        ? Response.json({ access_token: "tok" })
        : Response.json({ sub: "g-123", email: "Priya@Example.com", email_verified: true, name: "Priya Sharma" })) as typeof fetch;
    const callback = (state: string, cookie = state) =>
      new Request(`http://localhost:3000/api/auth/oauth/google/callback?code=abc&state=${state}`, { headers: { cookie: `hm_oauth=${cookie}` } });

    await expect(finishOAuth("google", callback(start.state, "forged"), fetcher)).rejects.toThrow(/expired/);
    const start2 = await startOAuth("google", new Request("http://localhost:3000/"), "/letters");
    const { profile, next } = await finishOAuth("google", callback(start2.state), fetcher);
    expect(next).toBe("/letters");
    const first = await userForOAuth("google", profile);
    expect(first).toMatchObject({ isNew: false, user: { id: existing.id } });
    expect((await userForOAuth("google", { ...profile, email: "changed@example.com" })).user.id).toBe(existing.id);
    // A brand-new Google account has no password until they set one.
    const fresh = await userForOAuth("google", { id: "g-999", email: "new@example.com", name: "New Person" });
    expect(fresh.isNew).toBe(true);
    expect(await verifyLogin("new@example.com", "")).toBeNull();
  });
});
