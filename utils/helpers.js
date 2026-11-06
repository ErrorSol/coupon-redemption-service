import bcrypt from "bcryptjs";
import crypto from "crypto";
import ms from "ms";
import moment from "moment";
import AppError from "../middlewares/appError.js";

export const catchAsync = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

export const comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

export const generateSessionId = () => {
  return crypto.randomBytes(16).toString("hex");
};

export const calculateRefreshExpiresAt = (expiresIn) => {
  const milliseconds = ms(expiresIn);
  if (!milliseconds) {
    throw new AppError("Invalid expiration format", 400, {
      errors: [
        {
          field: "expiresIn",
          message: "Invalid expiration format",
        },
      ],  
    });
  }
  return new Date(Date.now() + milliseconds);
};

export const formatDate = (date) => {
  if (!date) return null;
  return moment(date).format("DD/MM/YYYY"); // Format dob in DD/MM/YYYY
};
