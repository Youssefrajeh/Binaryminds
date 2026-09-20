import cors from "cors";
import express from "express";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/profile", profileRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`CampusHub API listening on :${port}`);
});
