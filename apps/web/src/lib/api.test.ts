import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";

type Handler = (config: any) => any;
const requestHandler = (api.interceptors.request as any).handlers[0].fulfilled as Handler;
const responseError = (api.interceptors.response as any).handlers[0].rejected as (e: unknown) => Promise<never>;

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("api request interceptor", () => {
  it("adds the bearer token when logged in", () => {
    localStorage.setItem("campushub_token", "abc");
    const config = requestHandler({ headers: {} });
    expect(config.headers.Authorization).toBe("Bearer abc");
  });

  it("sends no Authorization header when logged out", () => {
    const config = requestHandler({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe("api 401 handling", () => {
  it("clears the session and redirects to /login", async () => {
    localStorage.setItem("campushub_token", "abc");
    localStorage.setItem("campushub_user", "{}");
    localStorage.setItem("campushub_last_active", "123456");
    const loc = { pathname: "/marketplace", href: "" };
    vi.stubGlobal("location", loc);

    await expect(responseError({ response: { status: 401 } })).rejects.toBeDefined();

    expect(localStorage.getItem("campushub_token")).toBeNull();
    expect(localStorage.getItem("campushub_user")).toBeNull();
    expect(localStorage.getItem("campushub_last_active")).toBeNull();
    expect(loc.href).toBe("/login?expired=true");
  });

  it("keeps the session for other errors", async () => {
    localStorage.setItem("campushub_token", "abc");
    await expect(responseError({ response: { status: 500 } })).rejects.toBeDefined();
    expect(localStorage.getItem("campushub_token")).toBe("abc");
  });
});
