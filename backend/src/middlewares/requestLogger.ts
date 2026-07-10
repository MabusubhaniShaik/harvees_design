import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { logger, summarizePayload } from "../utils/logger.js";

const REQUEST_ID_HEADER = "x-request-id";

const getFileSummary = (file: Express.Multer.File) => ({
  fieldName: file.fieldname,
  originalName: file.originalname,
  mimeType: file.mimetype,
  size: file.size,
});

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header(REQUEST_ID_HEADER) || randomUUID();
  const startedAt = process.hrtime.bigint();

  res.locals.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const requestLog = logger.child({
    requestId,
    method: req.method,
    path: req.originalUrl,
  });

  requestLog.info("API request started", {
    event: "api.request.started",
    ip: req.ip,
    params: summarizePayload(req.params),
    query: summarizePayload(req.query),
    body: summarizePayload(req.body),
    file: req.file ? getFileSummary(req.file) : undefined,
    files: Array.isArray(req.files)
      ? req.files.map(getFileSummary)
      : undefined,
    userAgent: req.get("user-agent"),
  });

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const responseContext = {
      event: "api.request.completed",
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      contentLength: res.getHeader("content-length"),
    };

    if (res.statusCode >= 500) {
      requestLog.error("API request failed", responseContext);
      return;
    }

    if (res.statusCode >= 400) {
      requestLog.error("API request completed with client error", responseContext);
      return;
    }

    requestLog.success("API request completed", responseContext);
  });

  next();
}
