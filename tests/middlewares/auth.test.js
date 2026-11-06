
import { jest } from "@jest/globals";

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: { verify: jest.fn() },
}));

jest.unstable_mockModule("../../models/userModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/refreshTokenModel.js", () => ({
  default: {
    findOne: jest.fn(),
  },
}));

// Import modules only AFTER registering all mocks.
const jwt = (await import("jsonwebtoken")).default;
const User = (await import("../../models/userModel.js")).default;
const RefreshToken = (await import("../../models/refreshTokenModel.js")).default;

const { verifyToken, requireRole,
  requireSelfOrAdmin, } = await import("../../middlewares/auth.js");


describe("verifyToken middleware", () => {
  let req, res, next;

 beforeEach(() => {
  jest.clearAllMocks();

  req = { headers: {}, cookies: {} };
  res = {};
  next = jest.fn();

  process.env.JWT_ACCESS_SECRET = "access-secret";
  process.env.JWT_REFRESH_SECRET = "refresh-secret";

  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: "user123",
      role: "ADMIN",
      status: "ACTIVE",
    }),
  });

  RefreshToken.findOne.mockResolvedValue({
    userId: "user123",
    sessionId: "session123",
    token: "cookie-refresh",
  });
});

  it("should call next() with a 401 error when the token is missing", async () => {
    await verifyToken("access")(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(401);
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it("should verify an access token from the Authorization header", async () => {
    const decoded = {
    id: "user123",
    sessionId: "session123",
  };
    req.headers.authorization = "Bearer header-token";
    jwt.verify.mockReturnValue(decoded);

    await verifyToken("access")(req, res, next);
    expect(jwt.verify).toHaveBeenCalledWith("header-token", "access-secret");
    expect(req.user).toBe(decoded);
    expect(req.refreshToken).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  it("should verify a refresh token from cookies and set req.refreshToken", async () => {
    const decoded = { id: "user123" };
    req.cookies.refreshToken = "cookie-refresh";
    jwt.verify.mockReturnValue(decoded);

    await verifyToken("refresh")(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith("cookie-refresh", "refresh-secret");
    expect(req.user).toBe(decoded);
    expect(req.refreshToken).toBe("cookie-refresh");
    expect(next).toHaveBeenCalledWith();
  });

  it("should forward the error to next() when verification throws", async () => {
    req.cookies.accessToken = "bad-token";
    jwt.verify.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    await verifyToken("access")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(req.user).toBeUndefined();
  });
  
  it("should reject an inactive user", async () => {
    req.headers.authorization = "Bearer valid-token";
    jwt.verify.mockReturnValue({
      id: "user123",
      sessionId: "session123",
    });

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: "user123",
        role: "CUSTOMER",
        status: "INACTIVE",
      }),
    });

    await verifyToken("access")(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(401);
    expect(RefreshToken.findOne).not.toHaveBeenCalled();
  });

  it("should reject a user who does not exist", async () => {
    req.headers.authorization = "Bearer valid-token";
    jwt.verify.mockReturnValue({
      id: "deleted-user",
      sessionId: "session123",
    });

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await verifyToken("access")(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(401);
    expect(RefreshToken.findOne).not.toHaveBeenCalled();
  });

  it("should reject an access token with no sessionId", async () => {
    req.headers.authorization = "Bearer valid-token";
    jwt.verify.mockReturnValue({
      id: "user123",
    });

    await verifyToken("access")(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(401);
    expect(RefreshToken.findOne).not.toHaveBeenCalled();
  });

  it("should reject an expired or revoked access session", async () => {
    req.headers.authorization = "Bearer valid-token";
    jwt.verify.mockReturnValue({
      id: "user123",
      sessionId: "session123",
    });

    RefreshToken.findOne.mockResolvedValue(null);

    await verifyToken("access")(req, res, next);

    expect(RefreshToken.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user123",
        sessionId: "session123",
        expiresAt: expect.any(Object),
      })
    );

    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it("should reject an invalid or expired refresh session", async () => {
    req.cookies.refreshToken = "expired-refresh-token";

    jwt.verify.mockReturnValue({
      id: "user123",
    });

    RefreshToken.findOne.mockResolvedValue(null);

    await verifyToken("refresh")(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(next.mock.calls[0][0].code).toBe(
      "INVALID_REFRESH_SESSION"
    );
  });

});
describe("requireRole middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = { auth: {} };
    res = {};
    next = jest.fn();
  });

  it("should allow a user with the required role", async () => {
    req.auth = {
      userId: "admin123",
      role: "ADMIN",
    };

    await requireRole("ADMIN")(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should reject a user with the wrong role", async () => {
    req.auth = {
      userId: "customer123",
      role: "CUSTOMER",
    };

    await requireRole("ADMIN")(req, res, next);

    const error = next.mock.calls[0][0];

    expect(error.statusCode).toBe(403);
    expect(error.message).toBe(
      "You are not allowed to perform this action"
    );
  });

  it("should reject requests without authentication", async () => {
    req.auth = undefined;

    await requireRole("ADMIN")(req, res, next);

    const error = next.mock.calls[0][0];

    expect(error.statusCode).toBe(401);
  });
});

describe("requireSelfOrAdmin middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: { id: "customer123" },
      auth: {},
    };

    res = {};
    next = jest.fn();
  });

  it("should allow a customer to access their own account", async () => {
    req.auth = {
      userId: "customer123",
      role: "CUSTOMER",
    };

    await requireSelfOrAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should allow an admin to access another user's account", async () => {
    req.auth = {
      userId: "admin123",
      role: "ADMIN",
    };

    await requireSelfOrAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should reject a customer accessing another user's account", async () => {
    req.auth = {
      userId: "customer456",
      role: "CUSTOMER",
    };

    await requireSelfOrAdmin(req, res, next);

    const error = next.mock.calls[0][0];

    expect(error.statusCode).toBe(403);
    expect(error.message).toBe(
      "You are not allowed to access this user's account"
    );
  });

  it("should reject requests without authentication", async () => {
    req.auth = undefined;

    await requireSelfOrAdmin(req, res, next);

    const error = next.mock.calls[0][0];

    expect(error.statusCode).toBe(401);
  });

});