process.env.JWT_REFRESH_SECRET = "itest-refresh-secret";
import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

// Must be set before app (and its auth middleware) is imported/used.
process.env.JWT_ACCESS_SECRET = "itest-access-secret";

jest.unstable_mockModule("../../models/userModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/refreshTokenModel.js", () => ({
  default: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
// Mock the persistence layer so the HTTP/middleware/routing stack is exercised
// end-to-end without a database.
jest.unstable_mockModule("../../services/productService.js", () => ({
  getAllProductsService: jest.fn(),
  createProductService: jest.fn(),
  getProductByIdService: jest.fn(),
  updateProductService: jest.fn(),
  deleteProductService: jest.fn(),
  purchaseProductService: jest.fn(),
}));

// Silence structured logging during integration runs.
jest.unstable_mockModule("../../utils/logger.js", () => ({
  default: { log: jest.fn() },
}));
jest.unstable_mockModule("../../services/authUserService.js", () => ({
  loginUserService: jest.fn(),
  refreshUserAccessTokenService: jest.fn(),
  logoutUserService: jest.fn(),
}));
const productService = await import("../../services/productService.js");
const app = (await import("../../app.js")).default;
const authService = await import("../../services/authUserService.js");
const User = (await import("../../models/userModel.js")).default;
const RefreshToken = (await import("../../models/refreshTokenModel.js"))
  .default;
describe("app integration", () => {
  beforeEach(() => {
  jest.clearAllMocks();

  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: "admin1",
      role: "ADMIN",
      status: "ACTIVE",
    }),
  });

  RefreshToken.findOne.mockResolvedValue({
    userId: "admin1",
    sessionId: "test-session",
    token: "test-refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
});
  it("GET /healthcheck should return 200", async () => {
    const res = await request(app).get("/healthcheck");
    expect(res.status).toBe(200);
    expect(res.text).toContain("HealthCheck");
  });

  it("unknown routes should hit the 404 error handler with the error envelope", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.errors[0].field).toBe("path");
  });

  it("public product list should return the success envelope", async () => {
    productService.getAllProductsService.mockResolvedValue({
      products: [{ name: "Widget" }],
      pagination: { totalCount: 1, page: 1, limit: 50 },
    });

    const res = await request(app).get("/api/public/products");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.products).toHaveLength(1);
  });

  it("purchase should reject an invalid quantity via validation (400)", async () => {
    const res = await request(app)
      .post("/api/public/products/p1/purchase")
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
    expect(productService.purchaseProductService).not.toHaveBeenCalled();
  });

  it("purchase should succeed with a valid quantity", async () => {
    productService.purchaseProductService.mockResolvedValue({
      _id: "p1",
      stock: 3,
    });

    const res = await request(app)
      .post("/api/public/products/p1/purchase")
      .send({ quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Product purchased successfully");
    expect(productService.purchaseProductService).toHaveBeenCalledWith("p1", 2);
  });

  it("admin routes should reject requests without a token (401)", async () => {
    const res = await request(app).get("/api/admin/products");
    expect(res.status).toBe(401);
    expect(res.body.errors[0].field).toBe("token");
  });

  it("admin routes should allow an authenticated caller", async () => {
    productService.getAllProductsService.mockResolvedValue({
      products: [],
      pagination: { totalCount: 0, page: 1, limit: 50 },
    });
    const token = jwt.sign({ id: "admin1" , sessionId: "test-session"}, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "1h",
    });

    const res = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });
});

describe("authentication integration", () => {
  const user = {
    id: "customer1",
    role: "CUSTOMER",
    status: "ACTIVE",
    sessionId: "session1",
  };

  it("should login successfully and return tokens", async () => {
    authService.loginUserService.mockImplementation(
      async (identifier, password, res) => {
        res.cookie("accessToken", "access123");
        res.cookie("refreshToken", "refresh123");

        return {
          accessToken: "access123",
          refreshToken: "refresh123",
          user,
        };
      }
    );

    const res = await request(app)
      .post("/api/users/login")
      .send({
        identifier: "customer@example.com",
        password: "password123",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe("access123");
    expect(res.body.data.refreshToken).toBe("refresh123");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("should refresh successfully using a valid refresh cookie", async () => {
    const refreshToken = jwt.sign(
      { id: "customer1" },
      process.env.JWT_REFRESH_SECRET || "itest-refresh-secret",
      { expiresIn: "1h" }
    );

    // The middleware must verify the customer and refresh session.
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: "customer1",
        role: "CUSTOMER",
        status: "ACTIVE",
      }),
    });

    RefreshToken.findOne.mockResolvedValue({
      userId: "customer1",
      sessionId: "session1",
      token: refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    authService.refreshUserAccessTokenService.mockImplementation(
      async (token, decodedUser, res) => {
        res.cookie("accessToken", "newAccess123");
        res.cookie("refreshToken", "newRefresh123");

        return { accessToken: "newAccess123" };
      }
    );

    const res = await request(app)
      .put("/api/users/update-refresh-access")
      .set("Cookie", `refreshToken=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe("newAccess123");
    expect(authService.refreshUserAccessTokenService).toHaveBeenCalled();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("should reject refresh when refresh cookie is missing", async () => {
    const res = await request(app)
      .put("/api/users/update-refresh-access");

    expect(res.status).toBe(401);
    expect(authService.refreshUserAccessTokenService).not.toHaveBeenCalled();
  });

  it("should logout successfully and clear cookies", async () => {
    const accessToken = jwt.sign(
      { id: "customer1", sessionId: "session1" },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "1h" }
    );

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: "customer1",
        role: "CUSTOMER",
        status: "ACTIVE",
      }),
    });

    RefreshToken.findOne.mockResolvedValue({
      userId: "customer1",
      sessionId: "session1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    authService.logoutUserService.mockImplementation(async () => ({
      deleted: true,
    }));

    const res = await request(app)
      .delete("/api/users/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(authService.logoutUserService).toHaveBeenCalled();
  });
});
