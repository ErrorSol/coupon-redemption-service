import express from "express";
import { verifyToken, requireRole } from "../middlewares/auth.js";
import { validateRedemptionBody } from "../middlewares/validateRedemptionBody.js";
import { requireIdempotencyKey, attachCorrelationId, redemptionErrorHandler } from "../middlewares/redemptionRequest.js";
import { redemptionRateLimit } from "../middlewares/redemptionRateLimit.js";
import { createRedemption } from "../controllers/redemptionController.js";

const router = express.Router();

router.use(attachCorrelationId);
router.post(
  "/",
  verifyToken("access"),
  requireRole("CUSTOMER"),
  redemptionRateLimit(20, 60_000),
  requireIdempotencyKey,
  validateRedemptionBody,
  createRedemption
);
router.use(redemptionErrorHandler);

export default router;
