import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createSocketServer } from "./socket/index.js";

const app = createApp();
const server = createServer(app);
createSocketServer(server);

const port = Number(process.env.PORT) || 4000;
server.listen(port, () => {
  console.log(`CampusHub API listening on :${port}`);
});
