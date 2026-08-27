import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

// ==========================================================
// JWT SECRET
// ==========================================================

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  return secret;
}

// ==========================================================
// JWT PAYLOAD
// ==========================================================

export interface JwtPayload {
  userId: string;
  role: string;
}

// ==========================================================
// GENERATE TOKEN
// ==========================================================

export function generateToken(
  payload: JwtPayload
): string {
  return jwt.sign(
    payload,
    getJwtSecret(),
    {
      expiresIn: "7d",
    }
  );
}

// ==========================================================
// VERIFY TOKEN
// ==========================================================

export function verifyToken(
  token: string
): JwtPayload {
  const decoded: unknown =
    jwt.verify(
      token,
      getJwtSecret()
    );

  if (
    typeof decoded !== "object" ||
    decoded === null
  ) {
    throw new Error(
      "Invalid JWT payload"
    );
  }

  const payload =
    decoded as Record<string, unknown>;

  if (
    typeof payload.userId !== "string" ||
    typeof payload.role !== "string"
  ) {
    throw new Error(
      "Invalid JWT payload"
    );
  }

  return {
    userId: payload.userId,
    role: payload.role,
  };
}