import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import RefreshToken from "../models/refreshTokenModel.js";
import { catchAsync } from "../utils/helpers.js";
import AppError from "./appError.js";

const authenticationError = (message = "Authentication required") =>
  new AppError(message, 401, {
    code: "UNAUTHENTICATED",
  });

export const verifyToken = (type) =>
  catchAsync(async (req, res, next) => {
    if (!["access", "refresh"].includes(type)) {
  throw authenticationError("Invalid token type");
}
    const secret =
      type === "access"
        ? process.env.JWT_ACCESS_SECRET
        : process.env.JWT_REFRESH_SECRET;

    const token =
      req.headers.authorization?.split(" ")[1] ||
      req.cookies?.[`${type}Token`];

    if (!token) {
      return next(
        new AppError("Token is missing", 401, {
          errors: [{ field: "token", message: "Token is missing" }],
        })
      );
    }

    // 1. Verify JWT signature and expiration.
    const decoded = jwt.verify(token, secret);

    const userId = decoded.id || decoded.sub;

    if (!userId) {
      throw authenticationError("Invalid authentication token");
    }

    // 2. Verify the user exists and is active.
    const user = await User.findById(userId).select("_id role status");

    if (!user || user.status !== "ACTIVE") {
      throw authenticationError("User is inactive or does not exist");
    }

    let sessionId;

    // 3. Verify the corresponding session is still valid.
    if (type === "access") {
      sessionId = decoded.sessionId;

      if (!sessionId) {
        throw authenticationError("Session information is missing");
      }

      const session = await RefreshToken.findOne({
        userId: user._id,
        sessionId,
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        throw authenticationError("Session has expired or been revoked");
      }
    } else if (type === "refresh") {
      const tokenRecord = await RefreshToken.findOne({
        token,
        userId: user._id,
        expiresAt: { $gt: new Date() },
      });

      if (!tokenRecord) {
        throw new AppError("Refresh session is invalid or expired", 403, {
          code: "INVALID_REFRESH_SESSION",
        });
      }

      sessionId = tokenRecord.sessionId;
    } else {
      throw authenticationError("Invalid token type");
    }

    req.user = decoded;
    req.auth = {
      userId: user._id,
      role: user.role,
      sessionId,
    };
    req.refreshToken = type === "refresh" ? token : null;

    next();
  });

// Role is taken from the verified database identity, not JWT claims.
export const requireRole = (role) =>
  catchAsync(async (req, res, next) => {
    if (!req.auth?.userId) {
      throw authenticationError();
    }

    if (req.auth.role !== role) {
      throw new AppError(
        "You are not allowed to perform this action",
        403,
        { code: "FORBIDDEN" }
      );
    }

    next();
  });


export const requireSelfOrAdmin = catchAsync(async (req, res, next) => {
  if (!req.auth?.userId) {
    throw authenticationError();
  }

  const isAdmin = req.auth.role === "ADMIN";

  const isOwner =
    String(req.auth.userId) === String(req.params.id);

  if (!isAdmin && !isOwner) {
    throw new AppError(
      "You are not allowed to access this user's account",
      403,
      { code: "FORBIDDEN" }
    );
  }

  next();
});

