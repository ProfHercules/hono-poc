import { Bucket, File, Storage } from "@google-cloud/storage";
import { LoggingWinston } from "@google-cloud/logging-winston";
import winston from "winston";

const loggingWinston = new LoggingWinston({ projectId: "hono-poc" });

const isDev = process.env.NODE_ENV === "development";

export const logger = winston.createLogger({
  level: "info",
  transports: [isDev ? new winston.transports.Console() : loggingWinston],
});

export const storage = new Storage({ projectId: "hono-poc" });
