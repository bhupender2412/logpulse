import dotenv from "dotenv";
import bcrypt from "bcryptjs";

import {
  connectDB,
} from "./config/db";

import {
  UserModel,
} from "./models/User";

dotenv.config();

// ==========================================================
// DEMO ACCOUNT
// ==========================================================

const DEMO_EMAIL =
  "demo@pulseengine.dev";

const DEMO_NAME =
  "PulseEngine Demo";

const DEMO_PASSWORD =
  process.env.DEMO_PASSWORD;

// ==========================================================
// CREATE / UPDATE DEMO USER
// ==========================================================

async function createDemoUser() {
  try {
    if (!DEMO_PASSWORD) {
      throw new Error(
        "DEMO_PASSWORD is not configured"
      );
    }

    await connectDB();

    const passwordHash =
      await bcrypt.hash(
        DEMO_PASSWORD,
        12
      );

    const existingUser =
      await UserModel.findOne({
        email:
          DEMO_EMAIL,
      });

    if (existingUser) {
      existingUser.name =
        DEMO_NAME;

      existingUser.password =
        passwordHash;

      existingUser.role =
        "demo";

      await existingUser.save();

      console.log(
        "Demo user updated successfully"
      );
    } else {
      await UserModel.create({
        name:
          DEMO_NAME,

        email:
          DEMO_EMAIL,

        password:
          passwordHash,

        role:
          "demo",
      });

      console.log(
        "Demo user created successfully"
      );
    }

    console.log(
      "Email:",
      DEMO_EMAIL
    );

    console.log(
      "Role: demo"
    );

    await mongooseDisconnect();
  } catch (error) {
    console.error(
      "Create Demo User Error:",
      error
    );

    process.exit(1);
  }
}

// ==========================================================
// CLEAN DISCONNECT
// ==========================================================

async function mongooseDisconnect() {
  const mongoose =
    await import(
      "mongoose"
    );

  await mongoose.default.disconnect();

  process.exit(0);
}

void createDemoUser();