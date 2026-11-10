import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { corsOptions } from "./lib/cors.js";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { requireAuth } from "./middleware/auth.middleware.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { conversationsRouter } from "./routes/conversations.js";
import { studyGroupsRouter } from "./routes/studyGroups.js";
import { listingsRouter } from "./routes/listings.js";
import { lostFoundRouter } from "./routes/lostFound.js";
import { eventsRouter } from "./routes/events.js";
import { adminRouter } from "./routes/admin.js";
import { reportsRouter } from "./routes/reports.js";
import { filesRouter } from "./routes/files.js";

export function createApp() {
  const app = express();

  // Render and nginx sit in front of the API; trust one hop so req.ip is the
  // client's address and per-IP rate limits work
  app.set("trust proxy", 1);

  app.use(cors(corsOptions()));
  // Photos and files arrive as base64 inside JSON, so only those routes accept
  // large bodies, and only from a signed-in student. Everything else, including
  // the public sign-in routes, is capped small before any work is done.
  for (const [path, limit] of UPLOAD_BODY_LIMITS) app.use(path, uploadBody(limit));
  app.use(express.json({ limit: "100kb" }));

  const apiRouter = express.Router();
  apiRouter.use("/health", healthRouter);
  apiRouter.use("/auth", authRouter);
  apiRouter.use("/profile", profileRouter);
  apiRouter.use("/conversations", conversationsRouter);
  apiRouter.use("/study-groups", studyGroupsRouter);
  apiRouter.use("/listings", listingsRouter);
  apiRouter.use("/lost-found", lostFoundRouter);
  apiRouter.use("/events", eventsRouter);
  apiRouter.use("/admin", adminRouter);
  apiRouter.use("/reports", reportsRouter);
  apiRouter.use("/files", filesRouter);

  app.use("/api", apiRouter);
  // Only the health check lives at the root: mounting the whole API there would
  // shadow SPA routes such as /study-groups and /profile/edit on page reload.
  app.use("/health", healthRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const webDist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../web/dist",
  );
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  // Must come after every route: turns errors into the JSON shape the web app reads
  app.use(jsonErrors);

  return app;
}

/** Routes that take photos or files, with their largest allowed request */
const UPLOAD_BODY_LIMITS: [string, string][] = [
  ["/api/listings", "16mb"], // up to 5 photos of 2 MB
  ["/api/conversations", "8mb"], // one shared file of up to 5 MB
  ["/api/events", "4mb"], // one 2 MB photo
  ["/api/lost-found", "4mb"], // one 2 MB photo
  ["/api/profile/me/avatar", "1mb"], // a resized 300 KB avatar
];

/** Checks the session before reading a large body on a write request */
function uploadBody(limit: string): RequestHandler {
  const parse = express.json({ limit });
  return (req, res, next) => {
    if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") return next();
    // If the session check answers first (401), discard the rest of the upload
    // without parsing or storing it. Closing mid-upload would reset the
    // connection, and the browser would show a network error, not the 401.
    res.once("finish", () => {
      if (!req.complete) req.resume();
    });
    void requireAuth(req, res, (err?: unknown) => (err ? next(err) : parse(req, res, next)));
  };
}

/**
 * Express's default handler answers errors with an HTML page that includes
 * the stack trace whenever NODE_ENV is not "production". Always answer with
 * JSON instead, and keep internal details in the server log.
 */
const jsonErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error("Unhandled error:", err);
  const message =
    err?.type === "entity.parse.failed" ? "The request body is not valid JSON"
    : err?.type === "entity.too.large" ? "The request is too large"
    : status === 500 ? "Internal server error"
    : "The request could not be processed";
  res.status(status).json({ error: message });
};
