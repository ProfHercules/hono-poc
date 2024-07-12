import { createWriteStream } from "node:fs";
import { memoryUsage } from "node:process";
import prettyBytes from "pretty-bytes";
import prettyMs from "pretty-ms";
import type { HttpBindings } from "@hono/node-server";
import { z, createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { GcsFileSchema, tempGcs } from "./gcs";
import { storage } from "./init";

const uploadFileRouteSchema = createRoute({
  method: "post",
  path: "/files",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            saveAs: z.string().optional(),
            file: GcsFileSchema,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "File uploaded",
      content: {
        "application/json": {
          schema: z.object({
            heapUsed: z.string(),
            heapTotal: z.string(),
            time: z.string(),
            gcsUri: z.string(),
          }),
        },
      },
    },
  },
});

export const app = new OpenAPIHono<{ Bindings: HttpBindings }>();

app.use(
  tempGcs({
    bucketName: "hono-poc-temp",
  })
);

app.openapi(uploadFileRouteSchema, async (c) => {
  const start = performance.now();
  const { saveAs, file } = c.req.valid("form");

  const tempFile = storage.bucket(file.bucket).file(file.name);
  const gcsFile = storage.bucket("hono-poc").file(saveAs ?? file.originalName);
  await tempFile.move(gcsFile);

  const time = performance.now() - start;

  const memUse = memoryUsage();

  const resp = {
    heapUsed: prettyBytes(memUse.heapUsed),
    heapTotal: prettyBytes(memUse.heapTotal),
    time: prettyMs(time),
    gcsUri: gcsFile.cloudStorageURI,
  };

  return c.json(resp, 200);
});

app.doc("/doc", {
  info: {
    title: "An API",
    version: "v1",
  },
  openapi: "3.0.0",
});
