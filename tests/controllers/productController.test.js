import { jest } from "@jest/globals";

// Mock all dependencies before importing
jest.unstable_mockModule("../../utils/helpers.js", () => ({
  catchAsync: jest.fn((fn) => async (req, res, next) => {
    try {
      return await fn(req, res, next);
    } catch (error) {
      throw error;
    }
  }),
}));

jest.unstable_mockModule("../../middlewares/appSuccess.js", () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule("../../services/productService.js", () => ({
  getAllProductsService: jest.fn(),
  createProductService: jest.fn(),
  getProductByIdService: jest.fn(),
  updateProductService: jest.fn(),
  deleteProductService: jest.fn(),
  purchaseProductService: jest.fn(),
}));

// Import after mocking
const AppSuccess = (await import("../../middlewares/appSuccess.js")).default;
const {
  getAllProductsService,
  createProductService,
  getProductByIdService,
  updateProductService,
  deleteProductService,
  purchaseProductService,
} = await import("../../services/productService.js");
const {
  getAllProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  purchaseProduct,
} = await import("../../controllers/productController.js");

describe("ProductController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, params: {}, query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("getAllProducts", () => {
    it("should fetch products and respond", async () => {
      const data = { products: [], pagination: {} };
      req.query = { limit: "5" };
      getAllProductsService.mockResolvedValue(data);

      await getAllProducts(req, res);

      expect(getAllProductsService).toHaveBeenCalledWith({ limit: "5" });
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "Products fetched successfully",
        data,
      });
    });
  });

  describe("createProduct", () => {
    it("should create a product and respond 201", async () => {
      const product = { _id: "p1", name: "Widget" };
      req.body = { name: "Widget", description: "d", price: 10 };
      createProductService.mockResolvedValue(product);

      await createProduct(req, res);

      expect(createProductService).toHaveBeenCalledWith(req.body);
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        statusCode: 201,
        message: "Product created successfully",
        data: product,
      });
    });
  });

  describe("getProductById", () => {
    it("should fetch a product by id and respond", async () => {
      const product = { _id: "p1" };
      req.params.id = "p1";
      getProductByIdService.mockResolvedValue(product);

      await getProductById(req, res);

      expect(getProductByIdService).toHaveBeenCalledWith("p1");
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "Product fetched successfully",
        data: product,
      });
    });
  });

  describe("updateProduct", () => {
    it("should update a product and respond", async () => {
      const product = { _id: "p1", name: "New" };
      req.params.id = "p1";
      req.body = { name: "New" };
      updateProductService.mockResolvedValue(product);

      await updateProduct(req, res);

      expect(updateProductService).toHaveBeenCalledWith("p1", { name: "New" });
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "Product updated successfully",
        data: product,
      });
    });
  });

  describe("deleteProduct", () => {
    it("should delete a product and respond", async () => {
      const deleted = { _id: "p1" };
      req.params.id = "p1";
      deleteProductService.mockResolvedValue(deleted);

      await deleteProduct(req, res);

      expect(deleteProductService).toHaveBeenCalledWith("p1");
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "Product deleted successfully",
        data: { deleted },
      });
    });
  });

  describe("purchaseProduct", () => {
    it("should purchase a product and respond", async () => {
      const product = { _id: "p1", stock: 3 };
      req.params.id = "p1";
      req.body = { quantity: 2 };
      purchaseProductService.mockResolvedValue(product);

      await purchaseProduct(req, res);

      expect(purchaseProductService).toHaveBeenCalledWith("p1", 2);
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "Product purchased successfully",
        data: product,
      });
    });
  });
});
