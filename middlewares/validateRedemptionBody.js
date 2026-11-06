import { catchAsync } from "../utils/helpers.js";
import AppError from "./appError.js";
import { redeemBodySchema } from "../utils/validationSchemas/redemptionSchema.js";

export const validateRedemptionBody = catchAsync(async (req, res, next) => {
  const { error, value } = redeemBodySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
  if (error) {
    return next(new AppError("Request validation failed", 400, {
      code: "VALIDATION_ERROR",
      details: error.details.map((item) => ({
        field: item.path.join("."),
        message: item.message,
      })),
    }));
  }
  req.body = value;
  next();
});
