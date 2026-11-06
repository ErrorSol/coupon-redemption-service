const AppError = (await import("../../middlewares/appError.js")).default;

describe("AppError", () => {
  it("should build an operational 4xx error with a 'fail' status", () => {
    const err = new AppError("Bad request", 400, {
      errors: [{ field: "name", message: "required" }],
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Bad request");
    expect(err.statusCode).toBe(400);
    expect(err.status).toBe("fail");
    expect(err.responseCode).toBe(1);
    expect(err.isOperational).toBe(true);
    expect(err.errors).toEqual([{ field: "name", message: "required" }]);
    expect(err.stack).toBeDefined();
  });

  it("should mark 5xx errors with an 'error' status and default empty errors", () => {
    const err = new AppError("Server exploded", 500);

    expect(err.status).toBe("error");
    expect(err.errors).toEqual([]);
  });
});
