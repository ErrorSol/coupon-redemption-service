import AppError from "../middlewares/appError.js";

// Percentage uses integer arithmetic and rounds half-up. All values are paise.
export const calculateDiscountPaise = (discountType, discountValue, orderAmountPaise) => {
  if (!Number.isSafeInteger(orderAmountPaise) || orderAmountPaise <= 0) {
    throw new AppError("Order amount must be a positive integer number of paise", 400, {
      errors: [{ field: "orderAmountPaise", message: "Must be an integer from 1 to 100000000" }],
    });
  }
  if (discountType === "PERCENTAGE") {
    return Math.floor((orderAmountPaise * discountValue + 50) / 100);
  }
  if (discountType === "FIXED") return discountValue;
  throw new AppError("Unsupported discount type", 400, {
    errors: [{ field: "discountType", message: "Must be PERCENTAGE or FIXED" }],
  });
};
