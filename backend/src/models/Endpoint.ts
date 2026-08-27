import mongoose from "mongoose";

// ==========================================================
// HTTP METHODS
// ==========================================================

const ALLOWED_METHODS = [
  "POST",
  "PUT",
  "PATCH",
] as const;

// ==========================================================
// ENDPOINT SCHEMA
// ==========================================================

const EndpointSchema =
  new mongoose.Schema(
    {
      // ----------------------------------------------------
      // PUBLIC ENDPOINT IDENTIFIER
      //
      // Example:
      // ep_a82c9f...
      // ----------------------------------------------------

      endpointId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
      },

      // ----------------------------------------------------
      // FRIENDLY NAME
      // ----------------------------------------------------

      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100,
      },

      // ----------------------------------------------------
      // PROJECT
      //
      // Example:
      // payment-service-v2
      // ----------------------------------------------------

      projectId: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      // ----------------------------------------------------
      // TARGET WEBHOOK URL
      // ----------------------------------------------------

      targetUrl: {
        type: String,
        required: true,
        trim: true,
      },

      // ----------------------------------------------------
      // HTTP METHOD
      // ----------------------------------------------------

      method: {
        type: String,
        enum: ALLOWED_METHODS,
        default: "POST",
        required: true,
      },

      // ----------------------------------------------------
      // RETRY CONFIGURATION
      // ----------------------------------------------------

      maxRetries: {
        type: Number,
        default: 3,
        min: 0,
        max: 10,
      },

      // ----------------------------------------------------
      // HMAC SIGNING SECRET
      //
      // This secret will later be used by the worker to
      // generate x-pulse-signature.
      //
      // select:false prevents normal database queries from
      // accidentally returning it.
      // ----------------------------------------------------

      signingSecret: {
        type: String,
        required: true,
        select: false,
      },

      // ----------------------------------------------------
      // ACTIVE / DISABLED
      // ----------------------------------------------------

      active: {
        type: Boolean,
        default: true,
        index: true,
      },

      // ----------------------------------------------------
      // OWNER
      // ----------------------------------------------------

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
// USEFUL INDEX
// ==========================================================

EndpointSchema.index({
  createdBy: 1,
  projectId: 1,
  createdAt: -1,
});

// ==========================================================
// MODEL
// ==========================================================

export const EndpointModel =
  mongoose.model(
    "Endpoint",
    EndpointSchema
  );