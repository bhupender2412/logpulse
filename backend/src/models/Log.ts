import { Schema, model, Document } from "mongoose";

export interface ILog extends Document {
  projectId: string;
  level: "info" | "warn" | "error" | "fatal";
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

const logSchema = new Schema(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },

    level: {
      type: String,
      required: true,
      index: true,
      enum: ["info", "warn", "error", "fatal"],
    },

    message: {
      type: String,
      required: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timeseries: {
      timeField: "timestamp",
      metaField: "projectId",
      granularity: "seconds",
    },
  }
);

export const LogModel = model<ILog>("Log", logSchema);