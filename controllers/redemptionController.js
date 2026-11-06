import { catchAsync } from "../utils/helpers.js";
import { redeemCoupon } from "../services/redemptionService.js";

export const createRedemption = catchAsync(async (req, res) => {
  const result = await redeemCoupon({
    customerId: req.auth.userId,
    payload: req.body,
    idempotencyKey: req.idempotencyKey,
  });
  if (result.replay) res.setHeader("Idempotent-Replay", "true");
  return res.status(result.statusCode).json({ success: true, data: result.data });
});
