import { createServer } from "node:http2";
import { serve } from "@hono/node-server";
import { app } from "./app";

function getPort() {
  try {
    return Number.parseInt(process.env.PORT ?? "3000", 10);
  } catch {
    return 3000;
  }
}

serve({
  fetch: app.fetch,
  port: getPort(),
  createServer,
});
