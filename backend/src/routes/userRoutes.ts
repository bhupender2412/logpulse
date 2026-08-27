import {
  Response,
  Router,
} from "express";

import {
  AuthenticatedRequest,
  requireAuth,
} from "../middleware/authMiddleware";

import { UserModel } from "../models/User";

const router =
  Router();

// ==========================================================
// CURRENT USER
// ==========================================================

router.get(
  "/me",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          success: false,
          error:
            "User authentication required",
        });
      }

      const user =
        await UserModel.findById(
          req.user.userId
        ).select(
          "-password"
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          error:
            "User not found",
        });
      }

      return res.status(200).json({
        success: true,

        user: {
          id:
            user._id.toString(),
          name:
            user.name,
          email:
            user.email,
          role:
            user.role,
        },
      });
    } catch (error) {
      console.error(
        "Get Me Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch current user",
      });
    }
  }
);

export default router;