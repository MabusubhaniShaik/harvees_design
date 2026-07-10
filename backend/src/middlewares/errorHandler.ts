import type { Request, Response, NextFunction } from "express";
import { logger, serializeError } from "../utils/logger.ts";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  void next;
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || "Internal Server Error";

  logger.error("API error handled", {
    event: "api.error",
    requestId: res.locals.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: status,
    error: serializeError(err),
  });

  res.status(status).json({ error: message });
}
