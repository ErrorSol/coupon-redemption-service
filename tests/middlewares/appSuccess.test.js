import { jest } from "@jest/globals";

const AppSuccess = (await import("../../middlewares/appSuccess.js")).default;

describe("AppSuccess", () => {
  let res;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("should send a 200 success envelope by default", () => {
    new AppSuccess(res, { message: "OK", data: { id: 1 } });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      responseCode: 0,
      status: "success",
      message: "OK",
      data: { id: 1 },
    });
  });

  it("should honor a custom statusCode", () => {
    new AppSuccess(res, { statusCode: 201, message: "Created", data: {} });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Created", status: "success" })
    );
  });
});
