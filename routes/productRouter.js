import express from "express";
import {
  getAllProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { validateRequest } from "../middlewares/validations.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../utils/validationSchemas/productSchema.js";

// Admin-only product management. Auth is enforced at the mount point
// (see indexRouter.js -> "/admin"), so routes here assume an authenticated admin.
const router = express.Router();

router
  .route("/")
  .get(getAllProducts)
  .post(validateRequest(createProductSchema), createProduct);

router
  .route("/:id")
  .get(getProductById)
  .put(validateRequest(updateProductSchema), updateProduct)
  .delete(deleteProduct);

export default router;
