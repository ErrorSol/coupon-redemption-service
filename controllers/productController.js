import { catchAsync } from "../utils/helpers.js";
import AppSuccess from "../middlewares/appSuccess.js";
import {
  getAllProductsService,
  createProductService,
  getProductByIdService,
  updateProductService,
  deleteProductService,
  purchaseProductService,
} from "../services/productService.js";

export const getAllProducts = catchAsync(async (req, res) => {
  const data = await getAllProductsService(req.query);
  return new AppSuccess(res, {
    message: "Products fetched successfully",
    data,
  });
});

export const createProduct = catchAsync(async (req, res) => {
  const product = await createProductService(req.body);
  return new AppSuccess(res, {
    statusCode: 201,
    message: "Product created successfully",
    data: product,
  });
});

export const getProductById = catchAsync(async (req, res) => {
  const product = await getProductByIdService(req.params.id);
  return new AppSuccess(res, {
    message: "Product fetched successfully",
    data: product,
  });
});

export const updateProduct = catchAsync(async (req, res) => {
  const product = await updateProductService(req.params.id, req.body);
  return new AppSuccess(res, {
    message: "Product updated successfully",
    data: product,
  });
});

export const deleteProduct = catchAsync(async (req, res) => {
  const deleted = await deleteProductService(req.params.id);
  return new AppSuccess(res, {
    message: "Product deleted successfully",
    data: { deleted },
  });
});

export const purchaseProduct = catchAsync(async (req, res) => {
  const { quantity } = req.body;
  const product = await purchaseProductService(req.params.id, quantity);
  return new AppSuccess(res, {
    message: "Product purchased successfully",
    data: product,
  });
});
