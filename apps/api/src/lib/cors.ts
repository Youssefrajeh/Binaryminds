import type { CorsOptions } from "cors";

/**
 * Allowed browser origins, shared by Express and Socket.IO.
 * CLIENT_URL may hold several comma-separated origins. When it is unset the
 * API reflects any origin, which suits local dev and the same-origin Render
 * deploy (the API serves the web app itself).
 */
export function corsOptions(): CorsOptions {
  const origins = (process.env.CLIENT_URL ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return { origin: origins.length > 0 ? origins : true };
}
