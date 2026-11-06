import crypto from "node:crypto";
import AppError from "./appError.js";
import { idempotencyKeySchema } from "../utils/validationSchemas/redemptionSchema.js";

export const requireIdempotencyKey = (req, res, next) => {
  const key = req.get("Idempotency-Key");
  const { error, value } = idempotencyKeySchema.validate(key);
  if (error) return next(new AppError("A valid UUID v4 Idempotency-Key header is required", 400, {
    code: "IDEMPOTENCY_KEY_REQUIRED",
  }));
  req.idempotencyKey = value.toLowerCase();
  next();
};

export const attachCorrelationId = (req, res, next) => {
  const supplied = req.get("X-Correlation-ID");
  req.correlationId = supplied && supplied.length <= 100 ? supplied : crypto.randomUUID();
  res.setHeader("X-Correlation-ID", req.correlationId);
  next();
};

export const redemptionErrorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_ERROR";
  const details = error.details || (error.errors?.length ? error.errors : undefined);
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: statusCode >= 500 && code === "INTERNAL_ERROR"
        ? "An unexpected error occurred"
        : error.message,
      ...(details ? { details } : {}),
      correlationId: req.correlationId,
    },
  });
};
