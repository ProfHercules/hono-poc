import { createMiddleware } from "hono/factory";
import busboy from "busboy";
import { ulid } from "ulid";
import { z } from "@hono/zod-openapi";
import { storage, logger } from "./init";

export const GcsFileSchema = z
  .preprocess(
    (v) => JSON.parse(String(v)),
    z.object({
      bucket: z.string(),
      name: z.string(),
      originalName: z.string(),
    })
  )
  .openapi({
    type: "string",
    format: "binary",
  });
export type GcsFile = z.infer<typeof GcsFileSchema>;

export type TempGcsConfig = {
  bucketName: string;
};

export const tempGcs = (config: TempGcsConfig) => {
  const bucket = storage.bucket(config.bucketName);

  return createMiddleware(async (c, next) => {
    const contentType = c.req.header("Content-Type")?.toLowerCase();

    if (!contentType?.includes("multipart/form-data")) {
      await next();
      return;
    }

    logger.info("Detected multipart/form-data request, processing...");

    const newFormData = new FormData();
    const headers = c.req.header();

    const fileUploadPromises: Promise<void>[] = [];

    await new Promise((resolve, reject) => {
      const bb = busboy({ headers });

      bb.on("field", (name, val) => {
        newFormData.append(name, val);
      });

      bb.on("file", (name, file, info) => {
        const fileName = `temp_${ulid()}`;
        const gcsFile = bucket.file(fileName);
        logger.info(`Found file: ${name}, uploading to GCS at ${gcsFile.cloudStorageURI}`, {
          mimeType: info.mimeType,
          encoding: info.encoding,
          filename: info.filename,
        });
        const writeStream = gcsFile.createWriteStream({ resumable: false });
        const uploadPromise = new Promise<void>((resolve, reject) => {
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });
        fileUploadPromises.push(uploadPromise);

        file.pipe(writeStream);

        writeStream.on("finish", () => {
          newFormData.append(
            name,
            JSON.stringify({
              bucket: bucket.name,
              name: fileName,
              originalName: info.filename,
            } satisfies GcsFile)
          );
          logger.info(`File ${name} uploaded to GCS at ${gcsFile.cloudStorageURI}`);
        });
      });

      bb.on("finish", resolve);
      bb.on("error", reject);

      c.req.raw.body?.pipeTo(
        new WritableStream({
          write(chunk) {
            bb.write(chunk);
          },
          close() {
            bb.end();
          },
        })
      );
    });

    logger.info("Waiting for file uploads to complete...");
    await Promise.all(fileUploadPromises);
    logger.info("All file uploads completed");

    const newHeaders = new Headers(headers);
    newHeaders.delete("content-type");

    c.req.raw = new Request(c.req.url, {
      method: c.req.method,
      headers: newHeaders,
      body: newFormData,
      cache: c.req.raw.cache,
      credentials: c.req.raw.credentials,
      integrity: c.req.raw.integrity,
      keepalive: c.req.raw.keepalive,
      mode: c.req.raw.mode,
      redirect: c.req.raw.redirect,
      referrer: c.req.raw.referrer,
      referrerPolicy: c.req.raw.referrerPolicy,
      signal: c.req.raw.signal,
    });

    logger.info("Request body transformed, continuing...");
    await next();
  });
};
