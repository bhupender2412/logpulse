import mongoose from "mongoose";

// ==========================================================
// EVENT STATUS
// ==========================================================

const EVENT_STATUSES = [
  "queued",
  "processing",
  "retrying",
  "success",
  "failed",
] as const;

// ==========================================================
// ATTEMPT STATUS
// ==========================================================

const ATTEMPT_STATUSES = [
  "success",
  "failed",
] as const;

// ==========================================================
// DELIVERY ATTEMPT SCHEMA
// ==========================================================

const DeliveryAttemptSchema =
  new mongoose.Schema(
    {
      // ----------------------------------------------------
      // ATTEMPT NUMBER
      //
      // Example:
      // 1
      // 2
      // 3
      // ----------------------------------------------------

      attempt: {
        type: Number,
        required: true,
        min: 1,
      },

      // ----------------------------------------------------
      // ATTEMPT RESULT
      // ----------------------------------------------------

      status: {
        type: String,
        enum: ATTEMPT_STATUSES,
        required: true,
      },

      // ----------------------------------------------------
      // HTTP RESPONSE STATUS
      //
      // Example:
      // 200
      // 404
      // 500
      //
      // May be null when the request completely fails.
      // ----------------------------------------------------

      statusCode: {
        type: Number,
        default: null,
      },

      // ----------------------------------------------------
      // REQUEST LATENCY
      // ----------------------------------------------------

      latencyMs: {
        type: Number,
        default: null,
      },

      // ----------------------------------------------------
      // RESPONSE BODY
      // ----------------------------------------------------

      responseBody: {
        type:
          mongoose.Schema.Types.Mixed,

        default: null,
      },

      // ----------------------------------------------------
      // ERROR
      // ----------------------------------------------------

      error: {
        type: String,
        default: null,
      },

      // ----------------------------------------------------
      // ATTEMPT TIMESTAMP
      // ----------------------------------------------------

      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    }
  );

// ==========================================================
// WEBHOOK EVENT SCHEMA
// ==========================================================

const WebhookEventSchema =
  new mongoose.Schema(
    {
      // ----------------------------------------------------
      // PUBLIC EVENT ID
      //
      // Example:
      //
      // evt_a829d94c...
      // ----------------------------------------------------

      eventId: {
        type: String,

        required: true,

        unique: true,

        index: true,

        trim: true,
      },

      // ----------------------------------------------------
      // PROJECT
      // ----------------------------------------------------

      projectId: {
        type: String,

        required: true,

        index: true,

        trim: true,
      },

      // ----------------------------------------------------
      // TARGET ENDPOINT
      // ----------------------------------------------------

      endpointId: {
        type: String,

        required: true,

        index: true,

        trim: true,
      },

      // ----------------------------------------------------
      // USER / OWNER
      // ----------------------------------------------------

      createdBy: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "User",

        required:
          true,

        index:
          true,
      },

      // ----------------------------------------------------
      // WEBHOOK PAYLOAD
      // ----------------------------------------------------

      payload: {
        type:
          mongoose.Schema.Types.Mixed,

        required:
          true,
      },

      // ----------------------------------------------------
      // REDELIVERY SOURCE
      //
      // null:
      //
      // This is an original webhook event.
      //
      // evt_xxx:
      //
      // This event was manually created as a redelivery
      // of another webhook event.
      //
      // IMPORTANT:
      //
      // We store the public eventId rather than MongoDB _id.
      // This makes dashboard navigation and debugging easier.
      //
      // Example:
      //
      // Original:
      // evt_abc123
      //
      // Redelivery:
      // evt_xyz789
      //
      // redeliveryOf:
      // evt_abc123
      // ----------------------------------------------------

      redeliveryOf: {
        type: String,

        default:
          null,

        trim:
          true,

        index:
          true,
      },

      // ----------------------------------------------------
      // DELIVERY STATUS
      // ----------------------------------------------------

      status: {
        type: String,

        enum:
          EVENT_STATUSES,

        default:
          "queued",

        required:
          true,

        index:
          true,
      },

      // ----------------------------------------------------
      // NUMBER OF DELIVERY ATTEMPTS
      // ----------------------------------------------------

      attemptCount: {
        type: Number,

        default:
          0,

        min:
          0,
      },

      // ----------------------------------------------------
      // DELIVERY HISTORY
      //
      // Every BullMQ attempt gets its own immutable entry.
      // ----------------------------------------------------

      attempts: {
        type: [
          DeliveryAttemptSchema,
        ],

        default:
          [],
      },

      // ----------------------------------------------------
      // MOST RECENT HTTP STATUS
      //
      // Example:
      //
      // 200
      // 404
      // 500
      //
      // null when no HTTP response was received.
      // ----------------------------------------------------

      responseStatus: {
        type: Number,

        default:
          null,
      },

      // ----------------------------------------------------
      // MOST RECENT RESPONSE BODY
      // ----------------------------------------------------

      responseBody: {
        type:
          mongoose.Schema.Types.Mixed,

        default:
          null,
      },

      // ----------------------------------------------------
      // MOST RECENT LATENCY
      // ----------------------------------------------------

      latencyMs: {
        type: Number,

        default:
          null,
      },

      // ----------------------------------------------------
      // MOST RECENT ERROR
      // ----------------------------------------------------

      error: {
        type: String,

        default:
          null,
      },

      // ----------------------------------------------------
      // WHEN EVENT ENTERED THE QUEUE
      // ----------------------------------------------------

      queuedAt: {
        type: Date,

        default:
          Date.now,
      },

      // ----------------------------------------------------
      // WHEN PROCESSING STARTED
      // ----------------------------------------------------

      processingStartedAt: {
        type: Date,

        default:
          null,
      },

      // ----------------------------------------------------
      // WHEN EVENT FINISHED
      // ----------------------------------------------------

      completedAt: {
        type: Date,

        default:
          null,
      },
    },
    {
      timestamps:
        true,
    }
  );

// ==========================================================
// INDEXES
// ==========================================================

// ----------------------------------------------------------
// USER DASHBOARD
//
// Fetch newest webhook events belonging to a user.
// ----------------------------------------------------------

WebhookEventSchema.index({
  createdBy:
    1,

  createdAt:
    -1,
});

// ----------------------------------------------------------
// PROJECT HISTORY
// ----------------------------------------------------------

WebhookEventSchema.index({
  projectId:
    1,

  createdAt:
    -1,
});

// ----------------------------------------------------------
// ENDPOINT HISTORY
// ----------------------------------------------------------

WebhookEventSchema.index({
  endpointId:
    1,

  createdAt:
    -1,
});

// ----------------------------------------------------------
// STATUS FILTERING
//
// Useful for:
//
// failed events
// successful events
// retrying events
// ----------------------------------------------------------

WebhookEventSchema.index({
  status:
    1,

  createdAt:
    -1,
});

// ----------------------------------------------------------
// REDELIVERY HISTORY
//
// Allows us to efficiently answer:
//
// "Show all redeliveries created from evt_abc123"
// ----------------------------------------------------------

WebhookEventSchema.index({
  redeliveryOf:
    1,

  createdAt:
    -1,
});

// ----------------------------------------------------------
// USER + PROJECT DASHBOARD QUERY
// ----------------------------------------------------------

WebhookEventSchema.index({
  createdBy:
    1,

  projectId:
    1,

  createdAt:
    -1,
});

// ----------------------------------------------------------
// USER + ENDPOINT DASHBOARD QUERY
// ----------------------------------------------------------

WebhookEventSchema.index({
  createdBy:
    1,

  endpointId:
    1,

  createdAt:
    -1,
});

// ==========================================================
// MODEL
// ==========================================================

export const WebhookEventModel =
  mongoose.model(
    "WebhookEvent",
    WebhookEventSchema
  );