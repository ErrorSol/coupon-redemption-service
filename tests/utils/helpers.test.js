import { jest } from "@jest/globals";
import bcrypt from "bcryptjs";

const {
  catchAsync,
  comparePassword,
  generateSessionId,
  calculateRefreshExpiresAt,
  formatDate,
} = await import("../../utils/helpers.js");

describe("helpers", () => {
  describe("catchAsync", () => {
    it("should resolve the wrapped handler's result", async () => {
      const handler = jest.fn().mockResolvedValue("ok");
      const next = jest.fn();

      await catchAsync(handler)({}, {}, next);

      expect(handler).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward a rejected handler error to next()", async () => {
      const error = new Error("fail");
      const next = jest.fn();

      await catchAsync(jest.fn().mockRejectedValue(error))({}, {}, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("comparePassword", () => {
    it("should return true for a matching password", async () => {
      const hash = bcrypt.hashSync("secret", 8);
      await expect(comparePassword("secret", hash)).resolves.toBe(true);
    });

    it("should return false for a wrong password", async () => {
      const hash = bcrypt.hashSync("secret", 8);
      await expect(comparePassword("nope", hash)).resolves.toBe(false);
    });
  });

  describe("generateSessionId", () => {
    it("should return a 32-char hex string", () => {
      const id = generateSessionId();
      expect(id).toMatch(/^[a-f0-9]{32}$/);
      expect(generateSessionId()).not.toBe(id);
    });
  });

  describe("calculateRefreshExpiresAt", () => {
    it("should return a future Date for a valid duration", () => {
      const result = calculateRefreshExpiresAt("7d");
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(Date.now());
    });

    it("should throw for an invalid duration format", () => {
      expect(() => calculateRefreshExpiresAt("not-a-duration")).toThrow(
        "Invalid expiration format"
      );
    });
  });

  describe("formatDate", () => {
    it("should format a date as DD/MM/YYYY", () => {
      expect(formatDate("2026-07-08T00:00:00.000Z")).toMatch(
        /^\d{2}\/\d{2}\/\d{4}$/
      );
    });

    it("should return null for a falsy input", () => {
      expect(formatDate(null)).toBeNull();
    });
  });
});
