import Joi from "joi";

export const redeemBodySchema = Joi.object({
  couponCode: Joi.string().trim().min(1).max(20).required(),
  orderId: Joi.string().trim().min(1).max(64).required(),
  orderAmountPaise: Joi.number().integer().min(1).max(100_000_000).required(),
}).unknown(false);

export const idempotencyKeySchema = Joi.string().guid({ version: ["uuidv4"] }).required();
