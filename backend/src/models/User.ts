import mongoose from "mongoose";

// ==========================================================
// USER ROLES
// ==========================================================

export const USER_ROLES = [
  "admin",
  "demo",
] as const;

export type UserRole =
  (typeof USER_ROLES)[number];

// ==========================================================
// USER SCHEMA
// ==========================================================

const UserSchema =
  new mongoose.Schema(
    {
      // ----------------------------------------------------
      // NAME
      // ----------------------------------------------------

      name: {
        type: String,
        required: true,
        trim: true,
      },

      // ----------------------------------------------------
      // EMAIL
      // ----------------------------------------------------

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
      },

      // ----------------------------------------------------
      // PASSWORD
      // ----------------------------------------------------

      password: {
        type: String,
        required: true,
        minlength: 6,
      },

      // ----------------------------------------------------
      // ROLE
      //
      // admin:
      // Full access to PulseEngine.
      //
      // demo:
      // Portfolio/recruiter account.
      // Read access will be allowed while sensitive and
      // destructive operations will be restricted.
      // ----------------------------------------------------

      role: {
        type: String,
        enum:
          USER_ROLES,
        default:
          "admin",
        required:
          true,
      },
    },
    {
      timestamps:
        true,
    }
  );

// ==========================================================
// MODEL
// ==========================================================

export const UserModel =
  mongoose.model(
    "User",
    UserSchema
  );