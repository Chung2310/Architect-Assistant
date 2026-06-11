import { Router } from "express";
import { userController } from "../controller/user.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";

const router = Router();

/**
 * GET    /api/v1/users          - [Admin] Lấy danh sách users
 * GET    /api/v1/users/:id      - [Admin] Lấy user theo ID
 * PATCH  /api/v1/users/:id/role      - [Admin] Cập nhật role
 * PATCH  /api/v1/users/:id/credits   - [Admin] Cập nhật credits
 * PATCH  /api/v1/users/me/api-key    - [User] Cập nhật API key của chính mình
 * PATCH  /api/v1/users/:id/api-key   - [Admin] Cập nhật API key user
 * DELETE /api/v1/users/:id      - [Admin] Xóa user + dữ liệu
 * GET    /api/v1/users/transactions  - [Admin] Lấy tất cả transactions
 */
router.get("/transactions", authMiddleware, adminMiddleware, userController.getTransactions);
router.get("/me/transactions", authMiddleware, userController.getMyTransactions);
router.get("/", authMiddleware, adminMiddleware, userController.getList);
router.get("/:id", authMiddleware, adminMiddleware, userController.getById);
router.patch("/me/api-key", authMiddleware, userController.updateApiKey);
router.patch("/:id/role", authMiddleware, adminMiddleware, userController.updateRole);
router.patch("/:id/credits", authMiddleware, adminMiddleware, userController.updateCredits);
router.patch("/:id/api-key", authMiddleware, adminMiddleware, userController.updateApiKey);
router.delete("/:id", authMiddleware, adminMiddleware, userController.deleteUser);

export { router as userRouter };
