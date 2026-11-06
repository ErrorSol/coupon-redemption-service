import express from "express";
import {
  getAllProducts,
  getProductById,
  purchaseProduct,
} from "../controllers/productController.js";
import { validateRequest } from "../middlewares/validations.js";
import { purchaseProductSchema } from "../utils/validationSchemas/productSchema.js";

// Public, unauthenticated routes (storefront-style access).
const router = express.Router();

router.get("/products", getAllProducts);
router.get("/products/:id", getProductById);

// Storefront checkout hits this — the atomic-decrement teaching endpoint.
router.post(
  "/products/:id/purchase",
  validateRequest(purchaseProductSchema),
  purchaseProduct
);

export default router;
