import jwt from "jsonwebtoken";
import AppError from "../middlewares/appError.js";
import { userRefreshTokenPath } from "../config/constants.js";

// Helper function to convert time string to milliseconds
export const convertExpirationToMs = (expiration) => {
  const unit = expiration.slice(-1);
  const value = parseInt(expiration.slice(0, -1));

  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1000; // days to ms
    case "h":
      return value * 60 * 60 * 1000; // hours to ms
    case "m":
      return value * 60 * 1000; // minutes to ms
    case "s":
      return value * 1000; // seconds to ms
    default:
      return value; // already in ms
  }
};

export const generateAccessToken = (user, expiresIn) => {
  try {
    return jwt.sign(user, process.env.JWT_ACCESS_SECRET, { expiresIn }); // Use the provided expiration time
  } catch (error) {
    console.error(error);
    throw new AppError("Error during access token generation", 500, {
      errors: [
        {
          field: "accessToken",
          message: "Error during access token generation",
        },
      ],
    });
  }
};

export const generateRefreshToken = (userId, expiresIn) => {
  try {
    return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
      expiresIn,
    }); // Use the provided expiration time
  } catch (error) {
    console.error(error);
    throw new AppError("Error during refresh token generation", 500, {
      errors: [
        {
          field: "refreshToken",
          message: "Error during refresh token generation",
        },
      ],
    });
  }
};

export const setAccessTokenCookies = (res, accessToken) => {
  const maxAge = convertExpirationToMs(process.env.JWT_ACCESS_EXPIRATION);
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: maxAge,
  });
};

export const setRefreshTokenCookies = (res, refreshToken) => {
  const maxAge = convertExpirationToMs(process.env.JWT_REFRESH_EXPIRATION);
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: maxAge,
    path: userRefreshTokenPath,
  });
};
