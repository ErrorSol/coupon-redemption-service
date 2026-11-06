import { jest } from "@jest/globals";

// Mock all dependencies before importing
jest.unstable_mockModule("../../models/userModel.js", () => ({
  default: {
    findOne: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/refreshTokenModel.js", () => ({
  default: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.unstable_mockModule("../../utils/jwt.js", () => ({
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  setAccessTokenCookies: jest.fn(),
  setRefreshTokenCookies: jest.fn(),
}));

jest.unstable_mockModule("../../middlewares/appError.js", () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule("../../utils/helpers.js", () => ({
  comparePassword: jest.fn(),
  calculateRefreshExpiresAt: jest.fn(),
  generateSessionId: jest.fn(),
}));

jest.unstable_mockModule("../../config/constants.js", () => ({
  userRefreshTokenPath: "/refresh",
}));

// Import after mocking
const { loginUserService, refreshUserAccessTokenService, logoutUserService } =
  await import("../../services/authUserService.js");
const User = (await import("../../models/userModel.js")).default;
const RefreshToken = (await import("../../models/refreshTokenModel.js"))
  .default;
const {
  generateAccessToken,
  generateRefreshToken,
  setAccessTokenCookies,
  setRefreshTokenCookies,
} = await import("../../utils/jwt.js");
const AppError = (await import("../../middlewares/appError.js")).default;
const { comparePassword, calculateRefreshExpiresAt, generateSessionId } =
  await import("../../utils/helpers.js");

describe("AuthUserService", () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    res = {
      clearCookie: jest.fn(),
    };

    // Set up environment variables
    process.env.JWT_ACCESS_EXPIRATION = "15m";
    process.env.JWT_REFRESH_EXPIRATION = "7d";
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  });

  describe("loginUserService", () => {
    it("should login user with email successfully", async () => {
      const mockUser = {
        _id: "user123",
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        password: "hashedPassword",
        status: "ACTIVE",
        role: "CUSTOMER",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      User.findOne.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(true);
      generateSessionId.mockReturnValue("session123");
      generateAccessToken.mockReturnValue("accessToken123");
      generateRefreshToken.mockReturnValue("refreshToken123");
      calculateRefreshExpiresAt.mockReturnValue(new Date());
      RefreshToken.create.mockResolvedValue({});

      const result = await loginUserService(
        "john@example.com",
        "password123",
        res
      );

      expect(User.findOne).toHaveBeenCalledWith({ email: "john@example.com" });
      expect(comparePassword).toHaveBeenCalledWith(
        "password123",
        "hashedPassword"
      );
      expect(generateAccessToken).toHaveBeenCalled();
      expect(generateRefreshToken).toHaveBeenCalled();
      expect(RefreshToken.create).toHaveBeenCalled();
      expect(setAccessTokenCookies).toHaveBeenCalledWith(res, "accessToken123");
      expect(setRefreshTokenCookies).toHaveBeenCalledWith(
        res,
        "refreshToken123"
      );
      expect(result).toHaveProperty("accessToken", "accessToken123");
      expect(result).toHaveProperty("refreshToken", "refreshToken123");
      expect(result.user).toHaveProperty("email", "john@example.com");
    });

    it("should login user with phone successfully", async () => {
      const mockUser = {
        _id: "user123",
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        password: "hashedPassword",
        status: "ACTIVE",
        role: "CUSTOMER",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      User.findOne.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(true);
      generateSessionId.mockReturnValue("session123");
      generateAccessToken.mockReturnValue("accessToken123");
      generateRefreshToken.mockReturnValue("refreshToken123");
      calculateRefreshExpiresAt.mockReturnValue(new Date());
      RefreshToken.create.mockResolvedValue({});

      const result = await loginUserService("1234567890", "password123", res);

      expect(User.findOne).toHaveBeenCalledWith({ phone: "1234567890" });
      expect(result).toHaveProperty("accessToken", "accessToken123");
    });

    it("should throw error for invalid identifier", async () => {
      AppError.mockImplementation((message, code, details) => {
        const error = new Error(message);
        error.statusCode = code;
        error.errors = details.errors;
        return error;
      });

      await expect(
        loginUserService("invalid", "password123", res)
      ).rejects.toThrow();
    });

    it("should throw error when user not found", async () => {
      User.findOne.mockResolvedValue(null);
      AppError.mockImplementation((message, code, details) => {
        const error = new Error(message);
        error.statusCode = code;
        error.errors = details.errors;
        return error;
      });

      await expect(
        loginUserService("john@example.com", "password123", res)
      ).rejects.toThrow();
    });

    it("should throw error for incorrect password", async () => {
      const mockUser = {
        _id: "user123",
        password: "hashedPassword",
      };

      User.findOne.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(false);
      AppError.mockImplementation((message, code, details) => {
        const error = new Error(message);
        error.statusCode = code;
        error.errors = details.errors;
        return error;
      });

      await expect(
        loginUserService("john@example.com", "wrongpassword", res)
      ).rejects.toThrow();
    });
  });

  
describe("refreshUserAccessTokenService", () => {
  const mockUser = { id: "user123" };

  const mockUserRecord = {
    _id: "user123",
    name: "John Doe",
    email: "john@example.com",
    phone: "1234567890",
    role: "CUSTOMER",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    User.findById.mockResolvedValue(mockUserRecord);
    generateRefreshToken.mockReturnValue("newRefreshToken123");
    generateAccessToken.mockReturnValue("newAccessToken123");
    calculateRefreshExpiresAt.mockReturnValue(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );
  });

  it("should rotate refresh token and issue a new access token", async () => {
    RefreshToken.findOne.mockResolvedValue({
  userId: "user123",
  sessionId: "session123",
  token: "refreshToken123",
});
    RefreshToken.findOneAndUpdate.mockResolvedValue({
      userId: "user123",
      sessionId: "session123",
      token: "newRefreshToken123",
    });

    const result = await refreshUserAccessTokenService(
      "refreshToken123",
      mockUser,
      res
    );

    expect(User.findById).toHaveBeenCalledWith("user123");

    expect(generateRefreshToken).toHaveBeenCalledWith("user123", "7d");

    expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "refreshToken123",
        userId: "user123",
        expiresAt: expect.objectContaining({ $gt: expect.any(Date) }),
      }),
      {
        $set: {
          token: "newRefreshToken123",
          expiresAt: expect.any(Date),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    expect(generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user123",
        role: "CUSTOMER",
        status: "ACTIVE",
        sessionId: "session123",
      }),
      "15m"
    );

    expect(setAccessTokenCookies).toHaveBeenCalledWith(
      res,
      "newAccessToken123"
    );

    expect(setRefreshTokenCookies).toHaveBeenCalledWith(
      res,
      "newRefreshToken123"
    );

    expect(result).toHaveProperty("accessToken", "newAccessToken123");
  });

  it("should reject when refresh token is missing", async () => {
    AppError.mockImplementation((message, code, details) => {
      const error = new Error(message);
      error.statusCode = code;
      error.errors = details?.errors;
      error.code = details?.code;
      return error;
    });

    await expect(
      refreshUserAccessTokenService(null, mockUser, res)
    ).rejects.toThrow("Refresh token is missing");

    expect(RefreshToken.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("should reject when user does not exist", async () => {
    User.findById.mockResolvedValue(null);

    AppError.mockImplementation((message, code, details) => {
      const error = new Error(message);
      error.statusCode = code;
      error.code = details?.code;
      return error;
    });

    await expect(
      refreshUserAccessTokenService("refreshToken123", mockUser, res)
    ).rejects.toThrow("User is inactive or does not exist");

    expect(RefreshToken.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("should reject when user is inactive", async () => {
    User.findById.mockResolvedValue({
      ...mockUserRecord,
      status: "INACTIVE",
    });

    AppError.mockImplementation((message, code, details) => {
      const error = new Error(message);
      error.statusCode = code;
      error.code = details?.code;
      return error;
    });

    await expect(
      refreshUserAccessTokenService("refreshToken123", mockUser, res)
    ).rejects.toThrow("User is inactive or does not exist");

    expect(RefreshToken.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("should reject an expired, revoked, or already-used refresh token", async () => {
    RefreshToken.findOneAndUpdate.mockResolvedValue(null);

    AppError.mockImplementation((message, code, details) => {
      const error = new Error(message);
      error.statusCode = code;
      error.code = details?.code;
      return error;
    });

    await expect(
      refreshUserAccessTokenService("oldRefreshToken", mockUser, res)
    ).rejects.toThrow(
      "Refresh token is invalid, expired, or already used"
    );

    expect(setAccessTokenCookies).not.toHaveBeenCalled();
    expect(setRefreshTokenCookies).not.toHaveBeenCalled();
  });

  it("should reject when another request already rotated the token", async () => {
  RefreshToken.findOne.mockResolvedValue({
    userId: "user123",
    sessionId: "session123",
    token: "refreshToken123",
  });

  RefreshToken.findOne.mockResolvedValue(null);
  expect(RefreshToken.findOneAndUpdate).not.toHaveBeenCalled();

  AppError.mockImplementation((message, code, details) => {
    const error = new Error(message);
    error.statusCode = code;
    error.code = details?.code;
    return error;
  });

  await expect(
    refreshUserAccessTokenService("refreshToken123", mockUser, res)
  ).rejects.toThrow("Refresh token is invalid, expired, or already used");

  expect(setAccessTokenCookies).not.toHaveBeenCalled();
  expect(setRefreshTokenCookies).not.toHaveBeenCalled();
});
});


  describe("logoutUserService", () => {
    it("should logout user successfully", async () => {
      const mockUser = {
        id: "user123",
        sessionId: "session123",
      };

      RefreshToken.deleteOne.mockResolvedValue({
  acknowledged: true,
  deletedCount: 1,
});

      const result = await logoutUserService(mockUser, res);

      expect(RefreshToken.deleteOne).toHaveBeenCalledWith({
        userId: "user123",
        sessionId: "session123",
      });
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty("deleted", true);
    });
  });
});
