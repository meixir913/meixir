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

  it("finds sample centres by suburb, postcode and name, hiring first", async () => {
    const bySuburb = await search("parramatta");
    expect(bySuburb.results.map((r: { name: string }) => r.name)).toEqual(["Wattle Grove Early Learning Parramatta"]);
    expect(bySuburb.results[0].status).toBe("hiring");
    expect((await search("3186")).results[0].name).toBe("Banksia Kids Preschool");
    expect((await search("wattle grove")).total).toBe(2);
    expect((await search("wattle grove", "VIC")).total).toBe(0);
    const unchecked = (await search("kookaburra")).results[0];
    expect(unchecked.status).toBeNull();
    expect(unchecked.website).toBeNull();
  });
});
