import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { corsOptions } from "./lib/cors.js";
import express from "express";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { conversationsRouter } from "./routes/conversations.js";
import { studyGroupsRouter } from "./routes/studyGroups.js";
import { listingsRouter } from "./routes/listings.js";

export function createApp() {
  const app = express();

  app.use(cors(corsOptions()));
  // Large enough for listing photos (up to 5 x 2 MB) sent as data URLs
  app.use(express.json({ limit: "16mb" }));

  const apiRouter = express.Router();
  apiRouter.use("/health", healthRouter);
  apiRouter.use("/auth", authRouter);
  apiRouter.use("/profile", profileRouter);
  apiRouter.use("/conversations", conversationsRouter);
  apiRouter.use("/study-groups", studyGroupsRouter);
  apiRouter.use("/listings", listingsRouter);

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

  return app;
}
