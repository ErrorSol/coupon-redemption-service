import { jest } from "@jest/globals";

// Silence structured logging; assert it is invoked with the right level.
jest.unstable_mockModule("../../utils/logger.js", () => ({
  default: { log: jest.fn() },
}));

const Logger = (await import("../../utils/logger.js")).default;
const AppError = (await import("../../middlewares/appError.js")).default;
const globalErrorHandler = (
  await import("../../middlewares/globalErrorHandler.js")
).default;

describe("globalErrorHandler", () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  const bodyOf = () => res.json.mock.calls[0][0];

  it("should render an operational AppError (4xx) and log at warn", () => {
    const err = new AppError("Bad request", 400, {
      errors: [{ field: "name", message: "name is required" }],
    });

    globalErrorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = bodyOf();
    expect(body.status).toBe("fail");
    expect(body.errors).toEqual([{ field: "name", message: "name is required" }]);
    expect(Logger.log).toHaveBeenCalledWith(
      "warn",
      "Bad request",
      expect.objectContaining({ statusCode: "400" })
    );
  });

  it("should default an unknown error to 500 and log at error", () => {
    globalErrorHandler(new Error("boom"), {}, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = bodyOf();
    expect(body.errors[0].message).toBe("boom");
    expect(Logger.log).toHaveBeenCalledWith(
      "error",
      "boom",
      expect.objectContaining({ statusCode: "500" })
    );
  });

  it("should map a Joi error into field-level errors", () => {
    const joiError = {
      isJoi: true,
      details: [{ path: ["email"], message: '"email" is required' }],
    };

    globalErrorHandler(joiError, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bodyOf().errors).toEqual([
      { field: "email", message: "email is required" },
    ]);
  });

  it("should map a Mongoose ValidationError", () => {
    const mongooseError = {
      name: "ValidationError",
      errors: { price: { path: "price", message: "price is required" } },
    };

    globalErrorHandler(mongooseError, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bodyOf().errors).toEqual([
      { field: "price", message: "price is required" },
    ]);
  });

  it("should map a duplicate key (E11000) error", () => {
    const dupError = { code: 11000, keyValue: { email: "a@b.com" } };

    globalErrorHandler(dupError, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = bodyOf();
    expect(body.errors[0].field).toBe("email");
    expect(body.errors[0].message).toContain("a@b.com");
  });
});
