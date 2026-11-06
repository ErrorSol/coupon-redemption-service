import { jest } from "@jest/globals";

// Mock all dependencies before importing
jest.unstable_mockModule("../../models/productModel.js", () => ({
  default: {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
  },
  PRODUCT_STATUS: {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    OUT_OF_STOCK: "OUT_OF_STOCK",
  },
}));

jest.unstable_mockModule("../../utils/apiFeatures.js", () => ({
  APIFeatures: jest.fn(),
}));

jest.unstable_mockModule("../../middlewares/appError.js", () => ({
  default: jest.fn(),
}));

// Import after mocking
const Product = (await import("../../models/productModel.js")).default;
const { PRODUCT_STATUS } = await import("../../models/productModel.js");
const { APIFeatures } = await import("../../utils/apiFeatures.js");
const AppError = (await import("../../middlewares/appError.js")).default;
const {
  getAllProductsService,
  createProductService,
  getProductByIdService,
  updateProductService,
  deleteProductService,
  purchaseProductService,
} = await import("../../services/productService.js");

describe("ProductService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // resetMocks wipes the implementation before each test, so re-apply it here.
    AppError.mockImplementation((message, code, options) => {
      const error = new Error(message);
      error.statusCode = code;
      error.errors = options?.errors || [];
      return error;
    });
  });

  describe("getAllProductsService", () => {
    it("should return products with pagination via APIFeatures", async () => {
      const mockProducts = [{ name: "A" }, { name: "B" }];
      Product.find.mockReturnValue("query");
      APIFeatures.mockImplementation(() => ({
        process: jest.fn().mockResolvedValue(undefined),
        query: mockProducts,
        totalCount: 42,
        page: 2,
        limit: 10,
      }));

      const result = await getAllProductsService({ page: "2", limit: "10" });

      expect(APIFeatures).toHaveBeenCalledWith("query", {
        page: "2",
        limit: "10",
      });
      expect(result).toEqual({
        products: mockProducts,
        pagination: { totalCount: 42, page: 2, limit: 10 },
      });
    });
  });

  describe("createProductService", () => {
    it("should create and return a product", async () => {
      const payload = { name: "Widget", description: "d", price: 10 };
      const created = { _id: "p1", ...payload };
      Product.create.mockResolvedValue(created);

      const result = await createProductService(payload);

      expect(Product.create).toHaveBeenCalledWith(payload);
      expect(result).toBe(created);
    });
  });

  describe("getProductByIdService", () => {
    it("should return the product when found", async () => {
      const product = { _id: "p1", name: "Widget" };
      Product.findById.mockResolvedValue(product);

      const result = await getProductByIdService("p1");

      expect(Product.findById).toHaveBeenCalledWith("p1");
      expect(result).toBe(product);
    });

    it("should throw 404 when not found", async () => {
      Product.findById.mockResolvedValue(null);
      await expect(getProductByIdService("missing")).rejects.toThrow(
        "Product not found with this id"
      );
    });
  });

  describe("updateProductService", () => {
    it("should update and return the product", async () => {
      const updated = { _id: "p1", name: "New" };
      Product.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await updateProductService("p1", { name: "New" });

      expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
        "p1",
        { name: "New" },
        { new: true, runValidators: true }
      );
      expect(result).toBe(updated);
    });

    it("should throw 404 when not found", async () => {
      Product.findByIdAndUpdate.mockResolvedValue(null);
      await expect(
        updateProductService("missing", { name: "New" })
      ).rejects.toThrow("Product not found with this id");
    });
  });

  describe("deleteProductService", () => {
    it("should delete and return the product", async () => {
      const deleted = { _id: "p1" };
      Product.findByIdAndDelete.mockResolvedValue(deleted);

      const result = await deleteProductService("p1");

      expect(Product.findByIdAndDelete).toHaveBeenCalledWith("p1");
      expect(result).toBe(deleted);
    });

    it("should throw 404 when not found", async () => {
      Product.findByIdAndDelete.mockResolvedValue(null);
      await expect(deleteProductService("missing")).rejects.toThrow(
        "Product not found with this id"
      );
    });
  });

  describe("purchaseProductService (atomic decrement)", () => {
    it("should decrement stock atomically and return the product", async () => {
      const product = {
        _id: "p1",
        stock: 5,
        status: PRODUCT_STATUS.ACTIVE,
        save: jest.fn(),
      };
      Product.findOneAndUpdate.mockResolvedValue(product);

      const result = await purchaseProductService("p1", 2);

      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "p1", status: PRODUCT_STATUS.ACTIVE, stock: { $gte: 2 } },
        { $inc: { stock: -2 } },
        { new: true }
      );
      expect(product.save).not.toHaveBeenCalled();
      expect(result).toBe(product);
    });

    it("should flip status to OUT_OF_STOCK when stock hits 0", async () => {
      const product = {
        _id: "p1",
        stock: 0,
        status: PRODUCT_STATUS.ACTIVE,
        save: jest.fn().mockResolvedValue(undefined),
      };
      Product.findOneAndUpdate.mockResolvedValue(product);

      const result = await purchaseProductService("p1", 1);

      expect(product.status).toBe(PRODUCT_STATUS.OUT_OF_STOCK);
      expect(product.save).toHaveBeenCalled();
      expect(result).toBe(product);
    });

    it("should throw 404 when the product does not exist", async () => {
      Product.findOneAndUpdate.mockResolvedValue(null);
      Product.findById.mockResolvedValue(null);

      await expect(purchaseProductService("missing", 1)).rejects.toThrow(
        "Product not found with this id"
      );
    });

    it("should throw 400 when the product is not active", async () => {
      Product.findOneAndUpdate.mockResolvedValue(null);
      Product.findById.mockResolvedValue({
        _id: "p1",
        status: PRODUCT_STATUS.INACTIVE,
        stock: 5,
      });

      await expect(purchaseProductService("p1", 1)).rejects.toThrow(
        "Product is not available for purchase"
      );
    });

    it("should throw 400 for insufficient stock", async () => {
      Product.findOneAndUpdate.mockResolvedValue(null);
      Product.findById.mockResolvedValue({
        _id: "p1",
        status: PRODUCT_STATUS.ACTIVE,
        stock: 1,
      });

      await expect(purchaseProductService("p1", 5)).rejects.toThrow(
        "Insufficient stock"
      );
    });
  });
});
