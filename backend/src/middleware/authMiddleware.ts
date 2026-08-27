import {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  verifyToken,
  type JwtPayload,
} from "../utils/jwt";

// ==========================================================
// AUTHENTICATED REQUEST TYPE
// ==========================================================

export interface AuthenticatedRequest
  extends Request {
  user?: JwtPayload;
}

// ==========================================================
// REQUIRE AUTH
// ==========================================================

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authorization =
      req.headers.authorization;

    // ------------------------------------------------------
    // Authorization header missing
    // ------------------------------------------------------

    if (!authorization) {
      return res.status(401).json({
        success: false,
        error:
          "Authorization header is required",
      });
    }

    // ------------------------------------------------------
    // Expected:
    // Authorization: Bearer <token>
    // ------------------------------------------------------

    const [scheme, token] =
      authorization.split(" ");

    if (
      scheme !== "Bearer" ||
      !token
    ) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid authorization format",
      });
    }

    // ------------------------------------------------------
    // Verify JWT
    // ------------------------------------------------------

    const payload =
      verifyToken(token);

    // Attach authenticated user to request
    req.user = payload;

    return next();
  } catch (error) {
    console.error(
      "Auth Middleware Error:",
      error
    );

    return res.status(401).json({
      success: false,
      error:
        "Invalid or expired token",
    });
  }
}