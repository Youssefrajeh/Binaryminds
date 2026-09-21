import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";

const app = express();

app.use(cors());
app.use(express.json());

const apiRouter = express.Router();
apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/profile", profileRouter);

app.use("/api", apiRouter);
app.use("/", apiRouter);

const webDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/dist"
);
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`CampusHub API listening on :${port}`);
});
