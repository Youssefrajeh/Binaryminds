import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

/*
 * Account security flows against a real MongoDB, so the Prisma filters that
 * decide whether a session is still valid are exercised, not mocked.
 */

let database: MongoMemoryReplSet | undefined;
let prisma: PrismaClient;
let app: ReturnType<typeof import("../app.js").createApp>;
const sent: { to: string; html: string }[] = [];

const EMAIL = "new_student@fanshaweonline.ca";
const PASSWORD = "Campus#2026";
const ATTACKER_PASSWORD = "Attacker#2026";

/** The most recent code emailed to an address */
function lastCodeFor(email: string): string {
  const mail = [...sent].reverse().find((item) => item.to === email);
  const code = mail?.html.match(/code is (\d{6})/)?.[1];
  if (!code) throw new Error(`No code was emailed to ${email}`);
  return code;
}

function register(password = PASSWORD, email = EMAIL) {
  return request(app).post("/api/auth/register").send({ firstName: "Jane", lastName: "Doe", email, password, acceptTerms: true });
}

function login(password = PASSWORD, email = EMAIL) {
  return request(app).post("/api/auth/login").send({ email, password });
}

beforeAll(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const url = database.getUri("campushub_auth_test");
  const require = createRequire(import.meta.url);
  await promisify(execFile)(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--schema", fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)), "--skip-generate"], { env: { ...process.env, DATABASE_URL: url }, timeout: 60000 });
  prisma = new PrismaClient({ datasourceUrl: url });
  vi.doMock("../lib/prisma.js", () => ({ prisma }));
  vi.doMock("../lib/email.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../lib/email.js")>()),
    sendEmail: vi.fn(async (mail: { to: string; html: string }) => { sent.push(mail); }),
  }));
  const { createApp } = await import("../app.js");
  app = createApp();
}, 180000);

beforeEach(async () => {
  sent.length = 0;
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pendingRegistration.deleteMany();
});

afterAll(async () => {
  await prisma?.$disconnect();
  await database?.stop();
  vi.doUnmock("../lib/prisma.js");
  vi.doUnmock("../lib/email.js");
}, 30000);

describe("sign-up cannot be hijacked while it waits for verification", () => {
  it("refuses a second sign-up with a different password and keeps the original one", async () => {
    expect((await register()).status).toBe(201);
    const victimCode = lastCodeFor(EMAIL);

    const hijack = await register(ATTACKER_PASSWORD);
    expect(hijack.status).toBe(409);
    expect(sent).toHaveLength(1);

    // The real student's code still works and creates the account with their password
    expect((await request(app).post("/api/auth/verify").send({ email: EMAIL, otp: victimCode })).status).toBe(200);
    expect((await login(ATTACKER_PASSWORD)).status).toBe(401);
    expect((await login()).status).toBe(200);
  });

  it("lets the same student start again and sends them a fresh code", async () => {
    await register();
    const first = lastCodeFor(EMAIL);
    expect((await register()).status).toBe(201);
    const second = lastCodeFor(EMAIL);
    expect(sent).toHaveLength(2);

    const stale = await request(app).post("/api/auth/verify").send({ email: EMAIL, otp: first });
    if (first !== second) expect(stale.status).toBe(400);
    expect((await request(app).post("/api/auth/verify").send({ email: EMAIL, otp: second })).status).toBe(200);
  });

  it("allows a new sign-up with any password once the old one has expired", async () => {
    await register();
    await prisma.pendingRegistration.update({ where: { email: EMAIL }, data: { otpExpiresAt: new Date(Date.now() - 1000) } });

    expect((await register("Different#2026")).status).toBe(201);
    expect((await request(app).post("/api/auth/verify").send({ email: EMAIL, otp: lastCodeFor(EMAIL) })).status).toBe(200);
    expect((await login("Different#2026")).status).toBe(200);
  });
});

describe("verification", () => {
  it("answers a double-clicked Verify with one account and a clear 409, not a server error", async () => {
    await register();
    const otp = lastCodeFor(EMAIL);

    const results = await Promise.all([1, 2].map(() => request(app).post("/api/auth/verify").send({ email: EMAIL, otp })));
    const statuses = results.map((res) => res.status).sort();

    expect(statuses).not.toContain(500);
    expect(statuses[0]).toBe(200);
    expect(await prisma.user.count({ where: { email: EMAIL } })).toBe(1);
  });
});

describe("password reset ends existing sessions", () => {
  it("rejects tokens issued before the reset and accepts a fresh login", async () => {
    await register();
    const verified = await request(app).post("/api/auth/verify").send({ email: EMAIL, otp: lastCodeFor(EMAIL) });
    const oldToken = `Bearer ${verified.body.token}`;
    expect((await request(app).get("/api/profile/me").set("Authorization", oldToken)).status).toBe(200);

    // Tokens carry whole-second issue times; step past the second the token was issued in
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect((await request(app).post("/api/auth/forgot-password").send({ email: EMAIL })).status).toBe(200);
    const reset = await request(app).post("/api/auth/reset-password").send({ email: EMAIL, otp: lastCodeFor(EMAIL), newPassword: "Renewed#2026" });
    expect(reset.status).toBe(200);

    expect((await request(app).get("/api/profile/me").set("Authorization", oldToken)).status).toBe(401);
    expect((await login()).status).toBe(401);

    const fresh = await login("Renewed#2026");
    expect(fresh.status).toBe(200);
    expect((await request(app).get("/api/profile/me").set("Authorization", `Bearer ${fresh.body.token}`)).status).toBe(200);
  });

  it("keeps accounts that never reset their password signed in", async () => {
    // Accounts created before passwordChangedAt existed have no such field at all
    await register();
    const verified = await request(app).post("/api/auth/verify").send({ email: EMAIL, otp: lastCodeFor(EMAIL) });
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(stored.passwordChangedAt).toBeNull();
    expect((await request(app).get("/api/profile/me").set("Authorization", `Bearer ${verified.body.token}`)).status).toBe(200);
  });
});
