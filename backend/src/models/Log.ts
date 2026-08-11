import mongoose from "mongoose";

const LogSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      enum: ["info", "warn", "error", "fatal"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const LogModel = mongoose.model("Log", LogSchema);