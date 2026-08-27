import {
  Request,
  Response,
  Router,
} from "express";

import bcrypt from "bcryptjs";

import { UserModel } from "../models/User";

import {
  generateToken,
} from "../utils/jwt";

const router =
  Router();

// ==========================================================
// REGISTER
// ==========================================================

router.post(
  "/register",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        name,
        email,
        password,
      } = req.body;

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Name, email and password are required",
        });
      }

      if (
        password.length < 6
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Password must be at least 6 characters",
        });
      }

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const existingUser =
        await UserModel.findOne({
          email:
            normalizedEmail,
        });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error:
            "User already exists",
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          12
        );

      const user =
        await UserModel.create({
          name,
          email:
            normalizedEmail,
          password:
            hashedPassword,
          role: "admin",
        });

      const token =
        generateToken({
          userId:
            user._id.toString(),
          role:
            user.role,
        });

      return res.status(201).json({
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

        token,
      });
    } catch (error) {
      console.error(
        "Register Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Registration failed",
      });
    }
  }
);

// ==========================================================
// LOGIN
// ==========================================================

router.post(
  "/login",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Email and password are required",
        });
      }

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const user =
        await UserModel.findOne({
          email:
            normalizedEmail,
        });

      if (!user) {
        return res.status(401).json({
          success: false,
          error:
            "Invalid email or password",
        });
      }

      const passwordMatches =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          error:
            "Invalid email or password",
        });
      }

      const token =
        generateToken({
          userId:
            user._id.toString(),
          role:
            user.role,
        });

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

        token,
      });
    } catch (error) {
      console.error(
        "Login Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Login failed",
      });
    }
  }
);

export default router;