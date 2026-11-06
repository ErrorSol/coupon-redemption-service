import { jest } from "@jest/globals";

// Uses the real catchAsync + AppError so the whole validation path is exercised.
const { validateRequest } = await import("../../middlewares/validations.js");

describe("validateRequest middleware", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: { name: "raw" } };
    res = {};
    next = jest.fn();
  });

  it("should merge validated value and call next() on success", async () => {
    const schema = {
      validate: jest.fn().mockReturnValue({
        error: undefined,
        value: { name: "clean", extra: true },
      }),
    };

    await validateRequest(schema)(req, res, next);

    expect(schema.validate).toHaveBeenCalledWith(
      { name: "raw" },
      { abortEarly: false }
    );
    expect(req.body).toEqual({ name: "clean", extra: true });
    expect(next).toHaveBeenCalledWith();
  });

  it("should forward a ValidationError to next() on failure", async () => {
    const details = [{ path: ["email"], message: "email is required" }];
    const schema = {
      validate: jest.fn().mockReturnValue({ error: { details }, value: {} }),
    };

    await validateRequest(schema)(req, res, next);

    const forwarded = next.mock.calls[0][0];
    expect(forwarded).toBeInstanceOf(Error);
    expect(forwarded.name).toBe("ValidationError");
    expect(forwarded.statusCode).toBe(400);
    expect(forwarded.details).toBe(details);
  });
});
