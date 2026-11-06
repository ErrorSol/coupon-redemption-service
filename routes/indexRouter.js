import express from "express";
import userRouter from "./userRouter.js";
import adminRouter from "./adminRouter.js";
import publicRouter from "./publicRouter.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";
import customerRedemptionRouter from "./customerRedemptionRouter.js";

const router = express.Router();

// Authenticated user resource (self-contained login/logout/refresh + CRUD).
router.use("/users", userRouter);

// Admin-gated resources. NOTE: verifyToken("access") only proves the caller is
// authenticated — there is no `role` check yet, so any logged-in user reaches
router.use("/admin", verifyToken("access"),  requireRole("ADMIN"), adminRouter);

router.use("/customer/redemptions", customerRedemptionRouter);

// Public, unauthenticated resources (storefront-style reads + purchase).
router.use("/public", publicRouter);

export default router;
