import Product, { PRODUCT_STATUS } from "../models/productModel.js";
import { APIFeatures } from "../utils/apiFeatures.js";
import AppError from "../middlewares/appError.js";

export const getAllProductsService = async (queryString) => {
  // APIFeatures wraps the reusable filter/sort/field-limit/paginate chain.
  const features = new APIFeatures(Product.find(), queryString);
  await features.process();
  const products = await features.query;

  return {
    products,
    pagination: {
      totalCount: features.totalCount,
      page: features.page,
      limit: features.limit,
    },
  };
};

export const createProductService = async (productData) => {
  const product = await Product.create(productData);
  return product;
};

export const getProductByIdService = async (id) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new AppError("Product not found with this id", 404, {
      errors: [{ field: "id", message: "Product not found with this id" }],
    });
  }
  return product;
};

export const updateProductService = async (id, productData) => {
  const product = await Product.findByIdAndUpdate(id, productData, {
    new: true,
    runValidators: true,
  });
  if (!product) {
    throw new AppError("Product not found with this id", 404, {
      errors: [{ field: "id", message: "Product not found with this id" }],
    });
  }
  return product;
};

export const deleteProductService = async (id) => {
  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    throw new AppError("Product not found with this id", 404, {
      errors: [{ field: "id", message: "Product not found with this id" }],
    });
  }
  return product;
};

/**
 * Atomically decrement stock for a purchase.
 *
 * The guard lives in the QUERY FILTER, not in application code: we only match a
 * document that is ACTIVE and still has enough stock, then decrement in the same
 * operation. Because findOneAndUpdate is atomic at the document level, 200
 * concurrent buyers of the last unit produce exactly one winner — no read-then-write
 * race. This is the same pattern the coupon-redemption capstone needs.
 */
export const purchaseProductService = async (id, quantity) => {
  const product = await Product.findOneAndUpdate(
    { _id: id, status: PRODUCT_STATUS.ACTIVE, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { new: true }
  );

  if (!product) {
    // The filter didn't match — figure out why so the client gets a useful error.
    const existing = await Product.findById(id);
    if (!existing) {
      throw new AppError("Product not found with this id", 404, {
        errors: [{ field: "id", message: "Product not found with this id" }],
      });
    }
    if (existing.status !== PRODUCT_STATUS.ACTIVE) {
      throw new AppError("Product is not available for purchase", 400, {
        errors: [{ field: "status", message: "Product is not active" }],
      });
    }
    throw new AppError("Insufficient stock", 400, {
      errors: [
        {
          field: "quantity",
          message: `Only ${existing.stock} unit(s) available`,
        },
      ],
    });
  }

  // Flip to OUT_OF_STOCK once the last unit is gone.
  if (product.stock === 0 && product.status === PRODUCT_STATUS.ACTIVE) {
    product.status = PRODUCT_STATUS.OUT_OF_STOCK;
    await product.save();
  }

  return product;
};
