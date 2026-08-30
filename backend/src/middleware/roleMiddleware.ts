import {
  NextFunction,
  Response,
} from "express";

import {
  type AuthenticatedRequest,
} from "./authMiddleware";

// ==========================================================
// REQUIRE ADMIN ROLE
//
// IMPORTANT:
//
// requireAuth must run before this middleware.
//
// Example:
//
// router.delete(
//   "/:projectId",
//   requireAuth,
//   requireAdmin,
//   handler
// );
//
// Demo users are authenticated users, but they are not
// permitted to perform administrative/destructive actions.
// ==========================================================

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // ========================================================  
  // AUTHENTICATED USER REQUIRED
  // ========================================================

  if (!req.user) {
    return res
      .status(401)
      .json({
        success: false,
        error:
          "Authentication required",
      });
  }

  // ========================================================
  // ADMIN ROLE REQUIRED
  // ========================================================

  if (
    req.user.role !==
    "admin"
  ) {
    return res
      .status(403)
      .json({
        success: false,
        error:
          "This action is not available in demo mode",
      });
  }

  // ========================================================
  // AUTHORIZED
  // ========================================================

  return next();
}