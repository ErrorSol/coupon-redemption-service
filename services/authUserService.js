import User from "../models/userModel.js";
import RefreshToken from "../models/refreshTokenModel.js";
import {
  generateAccessToken,
  generateRefreshToken,
  setAccessTokenCookies,
  setRefreshTokenCookies,
} from "../utils/jwt.js";
import AppError from "../middlewares/appError.js";
import {
  comparePassword,
  calculateRefreshExpiresAt,
  generateSessionId,
} from "../utils/helpers.js";
import { userRefreshTokenPath } from "../config/constants.js";

export const loginUserService = async (identifier, password, res) => {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const isPhone = /^\d{10}$/.test(identifier);

  if (!isEmail && !isPhone) {
    throw new AppError("Invalid email or phone number", 400, {
      errors: [
        {
          field: "identifier",
          message: "Invalid email or phone number",
        },
      ],
    });
  }

  const userQuery = isEmail
  ? User.findOne({ email: identifier })
  : User.findOne({ phone: identifier });

const user =
  typeof userQuery.select === "function"
    ? await userQuery.select("+password")
    : await userQuery;

  if (!user) {
    throw new AppError(
      isEmail
        ? "No user found with this email"
        : "No user found with this phone number",
      404,
      {
        errors: [
          {
            field: "identifier",
            message:
              isEmail
                ? "No user found with this email"
                : "No user found with this phone number",
          },
        ],
      }
    );
  }

  const isPasswordCorrect = await comparePassword(password, user.password);
  if (!isPasswordCorrect) {
    throw new AppError("Incorrect password", 401, {
      errors: [
        {
          field: "password",
          message: "Incorrect password",
        },
      ],
    }); 
  }
if (user.status !== "ACTIVE") {
  throw new AppError("Your account is inactive", 403, {
    code: "ACCOUNT_INACTIVE",
  });
}
  // Generate sessionId
  const sessionId = generateSessionId();

  const detailedUser = {
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  sessionId,
};

  // Generate tokens
  const accessTokenDuration = process.env.JWT_ACCESS_EXPIRATION; // Access token expiration time
  const accessToken = generateAccessToken(detailedUser, accessTokenDuration);
  const refreshTokenDuration = process.env.JWT_REFRESH_EXPIRATION; // Refresh token expiration time
  const refreshToken = generateRefreshToken(
    user._id.toString(),
    refreshTokenDuration
  );

  // Dynamically calculate expiration time
  const expiresAt = calculateRefreshExpiresAt(refreshTokenDuration);

  // Save refresh token without replacing existing ones
  await RefreshToken.create({
    userId: user._id.toString(),
    sessionId,
    token: refreshToken,
    expiresAt,
  });

  // Set cookies
  setAccessTokenCookies(res, accessToken);
  setRefreshTokenCookies(res, refreshToken);

  return { accessToken, refreshToken, user: detailedUser };
};



export const refreshUserAccessTokenService = async (
  refreshToken,
  user,
  res
) => {
  if (!refreshToken) {
    throw new AppError("Refresh token is missing", 400, {
      errors: [
        {
          field: "refreshToken",
          message: "Refresh token is missing",
        },
      ],
    });
  }

  // 1. Verify the user.
  const userRecord = await User.findById(user.id);

  if (!userRecord || userRecord.status !== "ACTIVE") {
    throw new AppError("User is inactive or does not exist", 401, {
      code: "UNAUTHENTICATED",
    });
  }

  // 2. Find the existing refresh-token session.
  const now = new Date();

  const tokenRecord = await RefreshToken.findOne({
    token: refreshToken,
    userId: userRecord._id,
    expiresAt: { $gt: now },
  });

  if (!tokenRecord) {
    throw new AppError(
      "Refresh token is invalid, expired, or already used",
      403,
      { code: "INVALID_REFRESH_SESSION" }
    );
  }

  // 3. Preserve the existing session ID.
  const sessionId = tokenRecord.sessionId;

  const detailedUser = {
    id: userRecord._id.toString(),
    name: userRecord.name,
    email: userRecord.email,
    phone: userRecord.phone,
    role: userRecord.role,
    status: userRecord.status,
    createdAt: userRecord.createdAt,
    updatedAt: userRecord.updatedAt,
    sessionId,
  };

  // 4. Generate both new tokens BEFORE consuming the old token.
  const refreshTokenDuration = process.env.JWT_REFRESH_EXPIRATION;

  const newRefreshToken = generateRefreshToken(
    userRecord._id.toString(),
    refreshTokenDuration
  );

  const newExpiresAt = calculateRefreshExpiresAt(refreshTokenDuration);

  const accessTokenDuration = process.env.JWT_ACCESS_EXPIRATION;

  const newAccessToken = generateAccessToken(
    detailedUser,
    accessTokenDuration
  );

  // 5. Atomically replace the old refresh token.
  const updatedTokenRecord = await RefreshToken.findOneAndUpdate(
    {
      token: refreshToken,
      userId: userRecord._id,
      sessionId,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        token: newRefreshToken,
        expiresAt: newExpiresAt,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedTokenRecord) {
    throw new AppError(
      "Refresh token is invalid, expired, or already used",
      403,
      { code: "INVALID_REFRESH_SESSION" }
    );
  }

  // 6. Send the replacement cookies.
  setAccessTokenCookies(res, newAccessToken);
  setRefreshTokenCookies(res, newRefreshToken);

  return { accessToken: newAccessToken };
};


export const logoutUserService = async (loggedInUser, res) => {
  // Delete only the specific session's refresh token
  const result = await RefreshToken.deleteOne({
    userId: loggedInUser.id,
    sessionId: loggedInUser.sessionId,
  });
  const deleted = result.deletedCount > 0;

  // Clear cookies
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 0,
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 0,
    path: userRefreshTokenPath,
  });

  return { deleted };
};
