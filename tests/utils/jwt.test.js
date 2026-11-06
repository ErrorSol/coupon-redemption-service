import { jest } from "@jest/globals";

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: { sign: jest.fn() },
}));

const jwt = (await import("jsonwebtoken")).default;
const {
  convertExpirationToMs,
  generateAccessToken,
  generateRefreshToken,
  setAccessTokenCookies,
  setRefreshTokenCookies,
} = await import("../../utils/jwt.js");
const { userRefreshTokenPath } = await import("../../config/constants.js");

describe("jwt utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = "access-secret";
    process.env.JWT_REFRESH_SECRET = "refresh-secret";
    process.env.JWT_ACCESS_EXPIRATION = "1d";
    process.env.JWT_REFRESH_EXPIRATION = "7d";
  });

  describe("convertExpirationToMs", () => {
    it.each([
      ["1d", 86400000],
      ["2h", 7200000],
      ["30m", 1800000],
      ["10s", 10000],
    ])("should convert %s -> %d ms", (input, expected) => {
      expect(convertExpirationToMs(input)).toBe(expected);
    });
  });

  describe("generateAccessToken", () => {
    it("should sign the payload with the access secret", () => {
      jwt.sign.mockReturnValue("signed-access");
      const user = { id: "u1" };

      const token = generateAccessToken(user, "1d");

      expect(jwt.sign).toHaveBeenCalledWith(user, "access-secret", {
        expiresIn: "1d",
      });
      expect(token).toBe("signed-access");
    });

    it("should throw an AppError when signing fails", () => {
      jwt.sign.mockImplementation(() => {
        throw new Error("sign failed");
      });
      expect(() => generateAccessToken({ id: "u1" }, "1d")).toThrow(
        "Error during access token generation"
      );
    });
  });

  describe("generateRefreshToken", () => {
    it("should sign { id } with the refresh secret", () => {
      jwt.sign.mockReturnValue("signed-refresh");

      const token = generateRefreshToken("u1", "7d");

      expect(jwt.sign).toHaveBeenCalledWith({ id: "u1" }, "refresh-secret", {
        expiresIn: "7d",
      });
      expect(token).toBe("signed-refresh");
    });

    it("should throw an AppError when signing fails", () => {
      jwt.sign.mockImplementation(() => {
        throw new Error("sign failed");
      });
      expect(() => generateRefreshToken("u1", "7d")).toThrow(
        "Error during refresh token generation"
      );
    });
  });

  describe("cookie setters", () => {
    it("should set the access token cookie with the right flags", () => {
      const res = { cookie: jest.fn() };
      setAccessTokenCookies(res, "acc");

      expect(res.cookie).toHaveBeenCalledWith("accessToken", "acc", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 86400000,
      });
    });

    it("should set the refresh token cookie scoped to the refresh path", () => {
      const res = { cookie: jest.fn() };
      setRefreshTokenCookies(res, "ref");

      expect(res.cookie).toHaveBeenCalledWith("refreshToken", "ref", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 604800000,
        path: userRefreshTokenPath,
      });
    });
  });
});
