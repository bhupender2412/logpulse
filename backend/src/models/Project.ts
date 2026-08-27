import mongoose from "mongoose";

// ==========================================================
// PROJECT SCHEMA
// ==========================================================

const ProjectSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      projectId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
      },

      apiKeyHash: {
        type: String,
        required: true,
        select: false,
      },

      apiKeyLast4: {
        type: String,
        required: true,
      },

      createdBy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true,

        index: true,
      },
    },
    {
      timestamps: true,
    }
  );

// ==========================================================
// MODEL
// ==========================================================

export const ProjectModel =
  mongoose.model(
    "Project",
    ProjectSchema
  );