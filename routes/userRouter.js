import express from "express";
import {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  loginUser,
  logoutUser,
  refreshUserAccessToken,
} from "../controllers/userController.js";
import { verifyToken, requireRole,
  requireSelfOrAdmin, } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validations.js";
import {
  createUserSchema,
  updateUserSchema,
} from "../utils/validationSchemas/userSchema.js";

const router = express.Router();


router.route("/login").post(loginUser);

router
  .route("/update-refresh-access")
  .put(verifyToken("refresh"), refreshUserAccessToken);

router.route("/logout").delete(verifyToken("access"), logoutUser);

// Admin can list all users.
// Registration remains public and creates Customer accounts.
router
  .route("/")
  .get(verifyToken("access"), requireRole("ADMIN"), getAllUsers)
  .post(validateRequest(createUserSchema), createUser);

// Admin can access any account.
// Customer can access only their own account.
router
  .route("/:id")
  .get(
    verifyToken("access"),
    requireSelfOrAdmin,
    getUserById
  )
  .put(
    verifyToken("access"),
    requireSelfOrAdmin,
    validateRequest(updateUserSchema),
    updateUser
  )
  .delete(
    verifyToken("access"),
    requireRole("ADMIN"),
    deleteUser
  );

export default router;
