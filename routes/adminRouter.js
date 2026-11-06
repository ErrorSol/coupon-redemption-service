import express from "express";
import productRouter from "./productRouter.js";

// Admin routes are gated by verifyToken("access") where this router is mounted
// (see indexRouter.js). That gate only checks authentication, not an admin role
// — enforcing an actual admin role (requireRole) is a junior teaching exercise.
// Add other admin resources here.
const router = express.Router({ mergeParams: true });

router.use("/products", productRouter);

export default router;
