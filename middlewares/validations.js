import AppError from "./appError.js";
import { catchAsync } from "../utils/helpers.js";

export const validateRequest = (schema) =>
  catchAsync(async (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return next(
        Object.assign(new AppError("Validation Error", 400), {
          name: "ValidationError",
          details: error.details,
        })
      );
    }
    req.body = { ...req.body, ...value };
    next();
  });
