import crypto from "crypto";

import {
  Response,
  Router,
} from "express";

import mongoose from "mongoose";

import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware";

import {
  requireAdmin,
} from "../middleware/roleMiddleware";

import {
  EndpointModel,
} from "../models/Endpoint";

import {
  WebhookEventModel,
} from "../models/WebhookEvent";

import {
  webhookQueue,
} from "../queues/webhookQueue";

const router =
  Router();

// ==========================================================
// EVENT STATUSES
// ==========================================================

const VALID_EVENT_STATUSES = [
  "queued",
  "processing",
  "retrying",
  "success",
  "failed",
] as const;

type WebhookEventStatus =
  (typeof VALID_EVENT_STATUSES)[number];

// ==========================================================
// EVENT ANALYTICS TIME RANGE
// ==========================================================

type EventTimeRange =
  | "1h"
  | "6h"
  | "24h"
  | "7d"
  | "30d"
  | "all";

// ==========================================================
// TIME-SERIES CONFIG
// ==========================================================

interface EventTimeSeriesConfig {
  unit:
    | "minute"
    | "hour"
    | "day";

  binSize:
    number;

  bucketMs:
    number;
}

// ==========================================================
// POSITIVE INTEGER HELPER
// ==========================================================

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  max: number
): number {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    max
  );
}

// ==========================================================
// CHECK EVENT STATUS
// ==========================================================

function isValidEventStatus(
  value: unknown
): value is WebhookEventStatus {
  return (
    typeof value ===
      "string" &&
    VALID_EVENT_STATUSES.includes(
      value as WebhookEventStatus
    )
  );
}

// ==========================================================
// GENERATE WEBHOOK EVENT ID
// ==========================================================

function generateEventId(): string {
  return `evt_${crypto
    .randomBytes(16)
    .toString("hex")}`;
}

// ==========================================================
// PARSE EVENT TIME RANGE
// ==========================================================

function getEventTimeRange(
  value: unknown
): EventTimeRange {
  const validRanges:
    EventTimeRange[] = [
      "1h",
      "6h",
      "24h",
      "7d",
      "30d",
      "all",
    ];

  if (
    typeof value ===
      "string" &&
    validRanges.includes(
      value as EventTimeRange
    )
  ) {
    return value as EventTimeRange;
  }

  return "24h";
}

// ==========================================================
// GET EVENT RANGE START
// ==========================================================

function getEventRangeStart(
  range: EventTimeRange
): Date | null {
  const now =
    Date.now();

  switch (range) {
    case "1h":
      return new Date(
        now -
          60 *
            60 *
            1000
      );

    case "6h":
      return new Date(
        now -
          6 *
            60 *
            60 *
            1000
      );

    case "24h":
      return new Date(
        now -
          24 *
            60 *
            60 *
            1000
      );

    case "7d":
      return new Date(
        now -
          7 *
            24 *
            60 *
            60 *
            1000
      );

    case "30d":
      return new Date(
        now -
          30 *
            24 *
            60 *
            60 *
            1000
      );

    case "all":
    default:
      return null;
  }
}

// ==========================================================
// GET EVENT TIME-SERIES CONFIG
// ==========================================================

function getEventTimeSeriesConfig(
  range: EventTimeRange
): EventTimeSeriesConfig {
  switch (range) {
    case "1h":
      return {
        unit:
          "minute",

        binSize:
          5,

        bucketMs:
          5 *
          60 *
          1000,
      };

    case "6h":
      return {
        unit:
          "minute",

        binSize:
          30,

        bucketMs:
          30 *
          60 *
          1000,
      };

    case "24h":
      return {
        unit:
          "hour",

        binSize:
          1,

        bucketMs:
          60 *
          60 *
          1000,
      };

    case "7d":
    case "30d":
    case "all":
    default:
      return {
        unit:
          "day",

        binSize:
          1,

        bucketMs:
          24 *
          60 *
          60 *
          1000,
      };
  }
}

// ==========================================================
// ALIGN EVENT TIMESTAMP TO BUCKET
// ==========================================================

function alignEventToBucket(
  timestamp: number,
  config: EventTimeSeriesConfig
): number {
  const date =
    new Date(
      timestamp
    );

  if (
    config.unit ===
    "day"
  ) {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    );
  }

  if (
    config.unit ===
    "hour"
  ) {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours()
    );
  }

  const minutes =
    date.getUTCMinutes();

  const alignedMinutes =
    Math.floor(
      minutes /
        config.binSize
    ) *
    config.binSize;

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    alignedMinutes
  );
}

// ==========================================================
// FORMAT TIME-SERIES LABEL
// ==========================================================

function formatEventTimeSeriesLabel(
  date: Date,
  unit:
    | "minute"
    | "hour"
    | "day"
): string {
  if (
    unit ===
    "minute"
  ) {
    return date.toLocaleTimeString(
      "en-US",
      {
        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false,

        timeZone:
          "UTC",
      }
    );
  }

  if (
    unit ===
    "hour"
  ) {
    return date.toLocaleString(
      "en-US",
      {
        month:
          "short",

        day:
          "numeric",

        hour:
          "2-digit",

        hour12:
          false,

        timeZone:
          "UTC",
      }
    );
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      timeZone:
        "UTC",
    }
  );
}

// ==========================================================
// GET ALL WEBHOOK EVENTS
//
// GET /api/v1/events
// ==========================================================

router.get(
  "/",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      const page =
        parsePositiveInteger(
          req.query.page,
          1,
          100000
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          25,
          100
        );

      const skip =
        (page - 1) *
        limit;

      const filter: Record<
        string,
        unknown
      > = {
        createdBy:
          userId,
      };

      if (
        typeof req.query
          .projectId ===
          "string" &&
        req.query.projectId
          .trim() &&
        req.query.projectId !==
          "all"
      ) {
        filter.projectId =
          req.query.projectId
            .trim();
      }

      if (
        typeof req.query
          .endpointId ===
          "string" &&
        req.query.endpointId
          .trim() &&
        req.query.endpointId !==
          "all"
      ) {
        filter.endpointId =
          req.query.endpointId
            .trim();
      }

      if (
        isValidEventStatus(
          req.query.status
        )
      ) {
        filter.status =
          req.query.status;
      }

      const [
        events,
        total,
      ] =
        await Promise.all([
          WebhookEventModel.find(
            filter
          )
            .sort({
              createdAt:
                -1,
            })
            .skip(
              skip
            )
            .limit(
              limit
            )
            .lean(),

          WebhookEventModel.countDocuments(
            filter
          ),
        ]);

      const totalPages =
        total === 0
          ? 0
          : Math.ceil(
              total /
                limit
            );

      return res
        .status(200)
        .json({
          success:
            true,

          page,

          limit,

          total,

          totalPages,

          count:
            events.length,

          hasNextPage:
            totalPages >
              0 &&
            page <
              totalPages,

          hasPreviousPage:
            totalPages >
              0 &&
            page >
              1,

          filters: {
            projectId:
              typeof req.query
                .projectId ===
                "string"
                ? req.query
                    .projectId
                : "all",

            endpointId:
              typeof req.query
                .endpointId ===
                "string"
                ? req.query
                    .endpointId
                : "all",

            status:
              typeof req.query
                .status ===
                "string"
                ? req.query
                    .status
                : "all",
          },

          events,
        });
    } catch (error) {
      console.error(
        "Get Webhook Events Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to fetch webhook events",
        });
    }
  }
);

// ==========================================================
// GET WEBHOOK DELIVERY STATISTICS
//
// GET /api/v1/events/stats
//
// KEEP BEFORE /:eventId
// ==========================================================

router.get(
  "/stats",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      if (
        !mongoose.Types.ObjectId
          .isValid(
            userId
          )
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Invalid authenticated user",
          });
      }

      const authenticatedUserId =
        new mongoose.Types.ObjectId(
          userId
        );

      const match: Record<
        string,
        unknown
      > = {
        createdBy:
          authenticatedUserId,
      };

      if (
        typeof req.query
          .projectId ===
          "string" &&
        req.query.projectId
          .trim() &&
        req.query.projectId !==
          "all"
      ) {
        match.projectId =
          req.query.projectId
            .trim();
      }

      if (
        typeof req.query
          .endpointId ===
          "string" &&
        req.query.endpointId
          .trim() &&
        req.query.endpointId !==
          "all"
      ) {
        match.endpointId =
          req.query.endpointId
            .trim();
      }

      const aggregationResult =
        await WebhookEventModel
          .aggregate([
            {
              $match:
                match,
            },

            {
              $group: {
                _id:
                  null,

                total: {
                  $sum:
                    1,
                },

                queued: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "queued",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                processing: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "processing",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                retrying: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "retrying",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                successful: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "success",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                failed: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "failed",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                averageLatencyMs: {
                  $avg:
                    "$latencyMs",
                },
              },
            },
          ]);

      const rawStats =
        aggregationResult[0] ||
        {
          total:
            0,

          queued:
            0,

          processing:
            0,

          retrying:
            0,

          successful:
            0,

          failed:
            0,

          averageLatencyMs:
            0,
        };

      const total =
        Number(
          rawStats.total ||
            0
        );

      const queued =
        Number(
          rawStats.queued ||
            0
        );

      const processing =
        Number(
          rawStats.processing ||
            0
        );

      const retrying =
        Number(
          rawStats.retrying ||
            0
        );

      const successful =
        Number(
          rawStats.successful ||
            0
        );

      const failed =
        Number(
          rawStats.failed ||
            0
        );

      const averageLatencyMs =
        Number(
          Number(
            rawStats.averageLatencyMs ||
              0
          ).toFixed(
            2
          )
        );

      const completedDeliveries =
        successful +
        failed;

      const successRate =
        completedDeliveries ===
        0
          ? 0
          : Number(
              (
                (successful /
                  completedDeliveries) *
                100
              ).toFixed(
                2
              )
            );

      const failureRate =
        completedDeliveries ===
        0
          ? 0
          : Number(
              (
                (failed /
                  completedDeliveries) *
                100
              ).toFixed(
                2
              )
            );

      return res
        .status(200)
        .json({
          success:
            true,

          filters: {
            projectId:
              typeof req.query
                .projectId ===
                "string"
                ? req.query
                    .projectId
                : "all",

            endpointId:
              typeof req.query
                .endpointId ===
                "string"
                ? req.query
                    .endpointId
                : "all",
          },

          total,

          queued,

          processing,

          retrying,

          successful,

          failed,

          completedDeliveries,

          successRate,

          failureRate,

          averageLatencyMs,
        });
    } catch (error) {
      console.error(
        "Webhook Event Stats Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to calculate webhook delivery statistics",
        });
    }
  }
);

// ==========================================================
// GET WEBHOOK DELIVERY TIME SERIES
//
// GET /api/v1/events/timeseries
//
// ZERO-FILLED
//
// KEEP BEFORE /:eventId
// ==========================================================

router.get(
  "/timeseries",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      if (
        !mongoose.Types.ObjectId
          .isValid(
            userId
          )
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Invalid authenticated user",
          });
      }

      const authenticatedUserId =
        new mongoose.Types.ObjectId(
          userId
        );

      const range =
        getEventTimeRange(
          req.query.range
        );

      const rangeStart =
        getEventRangeStart(
          range
        );

      const config =
        getEventTimeSeriesConfig(
          range
        );

      const match: Record<
        string,
        unknown
      > = {
        createdBy:
          authenticatedUserId,
      };

      if (rangeStart) {
        match.createdAt = {
          $gte:
            rangeStart,
        };
      }

      if (
        typeof req.query
          .projectId ===
          "string" &&
        req.query.projectId
          .trim() &&
        req.query.projectId !==
          "all"
      ) {
        match.projectId =
          req.query.projectId
            .trim();
      }

      if (
        typeof req.query
          .endpointId ===
          "string" &&
        req.query.endpointId
          .trim() &&
        req.query.endpointId !==
          "all"
      ) {
        match.endpointId =
          req.query.endpointId
            .trim();
      }

      const aggregationResult =
        await WebhookEventModel
          .aggregate([
            {
              $match:
                match,
            },

            {
              $group: {
                _id: {
                  $dateTrunc: {
                    date:
                      "$createdAt",

                    unit:
                      config.unit,

                    binSize:
                      config.binSize,

                    timezone:
                      "UTC",
                  },
                },

                total: {
                  $sum:
                    1,
                },

                successful: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "success",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                failed: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "failed",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                queued: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "queued",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                processing: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "processing",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                retrying: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "retrying",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                averageLatencyMs: {
                  $avg:
                    "$latencyMs",
                },
              },
            },

            {
              $sort: {
                _id:
                  1,
              },
            },
          ]);

      const bucketMap =
        new Map<
          number,
          {
            total:
              number;

            successful:
              number;

            failed:
              number;

            queued:
              number;

            processing:
              number;

            retrying:
              number;

            averageLatencyMs:
              number;
          }
        >();

      aggregationResult.forEach(
        (
          point
        ) => {
          const timestamp =
            new Date(
              point._id
            ).getTime();

          bucketMap.set(
            timestamp,
            {
              total:
                Number(
                  point.total ||
                    0
                ),

              successful:
                Number(
                  point.successful ||
                    0
                ),

              failed:
                Number(
                  point.failed ||
                    0
                ),

              queued:
                Number(
                  point.queued ||
                    0
                ),

              processing:
                Number(
                  point.processing ||
                    0
                ),

              retrying:
                Number(
                  point.retrying ||
                    0
                ),

              averageLatencyMs:
                Number(
                  Number(
                    point.averageLatencyMs ||
                      0
                  ).toFixed(
                    2
                  )
                ),
            }
          );
        }
      );

      let startBucket:
        number;

      let endBucket:
        number;

      if (
        range ===
        "all"
      ) {
        if (
          aggregationResult.length ===
          0
        ) {
          return res
            .status(200)
            .json({
              success:
                true,

              range,

              interval: {
                unit:
                  config.unit,

                binSize:
                  config.binSize,
              },

              filters: {
                projectId:
                  typeof req.query
                    .projectId ===
                    "string"
                    ? req.query
                        .projectId
                    : "all",

                endpointId:
                  typeof req.query
                    .endpointId ===
                    "string"
                    ? req.query
                        .endpointId
                    : "all",
              },

              count:
                0,

              data:
                [],
            });
        }

        const timestamps =
          aggregationResult.map(
            (
              point
            ) =>
              new Date(
                point._id
              ).getTime()
          );

        startBucket =
          Math.min(
            ...timestamps
          );

        endBucket =
          Math.max(
            ...timestamps
          );
      } else {
        if (!rangeStart) {
          startBucket =
            alignEventToBucket(
              Date.now(),
              config
            );
        } else {
          startBucket =
            alignEventToBucket(
              rangeStart
                .getTime(),
              config
            );
        }

        endBucket =
          alignEventToBucket(
            Date.now(),
            config
          );
      }

      const data:
        Array<{
          timestamp:
            string;

          label:
            string;

          total:
            number;

          successful:
            number;

          failed:
            number;

          queued:
            number;

          processing:
            number;

          retrying:
            number;

          completedDeliveries:
            number;

          successRate:
            number;

          failureRate:
            number;

          averageLatencyMs:
            number;
        }> = [];

      for (
        let current =
          startBucket;
        current <=
        endBucket;
        current +=
          config.bucketMs
      ) {
        const bucket =
          bucketMap.get(
            current
          );

        const successful =
          bucket
            ?.successful ||
          0;

        const failed =
          bucket
            ?.failed ||
          0;

        const completedDeliveries =
          successful +
          failed;

        const successRate =
          completedDeliveries ===
          0
            ? 0
            : Number(
                (
                  (successful /
                    completedDeliveries) *
                  100
                ).toFixed(
                  2
                )
              );

        const failureRate =
          completedDeliveries ===
          0
            ? 0
            : Number(
                (
                  (failed /
                    completedDeliveries) *
                  100
                ).toFixed(
                  2
                )
              );

        const date =
          new Date(
            current
          );

        data.push({
          timestamp:
            date.toISOString(),

          label:
            formatEventTimeSeriesLabel(
              date,
              config.unit
            ),

          total:
            bucket
              ?.total ||
            0,

          successful,

          failed,

          queued:
            bucket
              ?.queued ||
            0,

          processing:
            bucket
              ?.processing ||
            0,

          retrying:
            bucket
              ?.retrying ||
            0,

          completedDeliveries,

          successRate,

          failureRate,

          averageLatencyMs:
            bucket
              ?.averageLatencyMs ||
            0,
        });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          range,

          interval: {
            unit:
              config.unit,

            binSize:
              config.binSize,
          },

          filters: {
            projectId:
              typeof req.query
                .projectId ===
                "string"
                ? req.query
                    .projectId
                : "all",

            endpointId:
              typeof req.query
                .endpointId ===
                "string"
                ? req.query
                    .endpointId
                : "all",
          },

          count:
            data.length,

          data,
        });
    } catch (error) {
      console.error(
        "Webhook Event Time Series Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to calculate webhook delivery time series",
        });
    }
  }
);

// ==========================================================
// GET WEBHOOK REDELIVERY HISTORY
//
// GET /api/v1/events/:eventId/redeliveries
//
// JWT PROTECTED
//
// IMPORTANT:
//
// Keep BEFORE:
//
// POST /:eventId/redeliver
// GET  /:eventId
// ==========================================================

router.get(
  "/:eventId/redeliveries",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      // ====================================================
      // AUTHENTICATED USER
      // ====================================================

      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      // ====================================================
      // NORMALIZE EVENT ID
      // ====================================================

      const rawEventId =
        req.params.eventId;

      const eventId =
        Array.isArray(
          rawEventId
        )
          ? rawEventId[0]
          : rawEventId;

      if (
        typeof eventId !==
          "string" ||
        !eventId.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Event ID is required",
          });
      }

      const normalizedEventId =
        eventId.trim();

      // ====================================================
      // VERIFY SOURCE EVENT EXISTS
      // ====================================================

      const sourceEvent =
        await WebhookEventModel.findOne({
          eventId:
            normalizedEventId,

          createdBy:
            userId,
        })
          .select({
            _id:
              0,

            eventId:
              1,

            projectId:
              1,

            endpointId:
              1,

            status:
              1,

            attemptCount:
              1,

            responseStatus:
              1,

            latencyMs:
              1,

            error:
              1,

            createdAt:
              1,

            completedAt:
              1,
          })
          .lean();

      if (!sourceEvent) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Webhook event not found",
          });
      }

      // ====================================================
      // FETCH REDELIVERIES
      //
      // Manual redelivery creates a new event containing:
      //
      // redeliveryOf = source event ID
      // ====================================================

      const redeliveries =
        await WebhookEventModel.find({
          redeliveryOf:
            normalizedEventId,

          createdBy:
            userId,
        })
          .select({
            _id:
              0,

            eventId:
              1,

            projectId:
              1,

            endpointId:
              1,

            redeliveryOf:
              1,

            status:
              1,

            attemptCount:
              1,

            responseStatus:
              1,

            latencyMs:
              1,

            error:
              1,

            queuedAt:
              1,

            processingStartedAt:
              1,

            completedAt:
              1,

            createdAt:
              1,
          })
          .sort({
            createdAt:
              -1,
          })
          .lean();

      // ====================================================
      // SUMMARY
      // ====================================================

      const successful =
        redeliveries.filter(
          (
            item
          ) =>
            item.status ===
            "success"
        ).length;

      const failed =
        redeliveries.filter(
          (
            item
          ) =>
            item.status ===
            "failed"
        ).length;

      const queued =
        redeliveries.filter(
          (
            item
          ) =>
            item.status ===
            "queued"
        ).length;

      const processing =
        redeliveries.filter(
          (
            item
          ) =>
            item.status ===
            "processing"
        ).length;

      const retrying =
        redeliveries.filter(
          (
            item
          ) =>
            item.status ===
            "retrying"
        ).length;

      const inProgress =
        queued +
        processing +
        retrying;

      // ====================================================
      // RESPONSE
      // ====================================================

      return res
        .status(200)
        .json({
          success:
            true,

          eventId:
            sourceEvent.eventId,

          sourceEvent,

          summary: {
            total:
              redeliveries.length,

            successful,

            failed,

            queued,

            processing,

            retrying,

            inProgress,
          },

          count:
            redeliveries.length,

          redeliveries,
        });
    } catch (error) {
      console.error(
        "Get Webhook Redelivery History Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to fetch webhook redelivery history",
        });
    }
  }
);

// ==========================================================
// MANUAL WEBHOOK REDELIVERY
//
// POST /api/v1/events/:eventId/redeliver
//
// Creates a completely NEW webhook event.
// ==========================================================


router.post(
  "/:eventId/redeliver",
  requireAuth,
  requireAdmin,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      const rawEventId =
        req.params.eventId;

      const eventId =
        Array.isArray(
          rawEventId
        )
          ? rawEventId[0]
          : rawEventId;

      if (
        typeof eventId !==
          "string" ||
        !eventId.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Event ID is required",
          });
      }

      const normalizedEventId =
        eventId.trim();

      const originalEvent =
        await WebhookEventModel.findOne({
          eventId:
            normalizedEventId,

          createdBy:
            userId,
        });

      if (!originalEvent) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Webhook event not found",
          });
      }

      if (
        originalEvent.status !==
        "failed"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            error:
              "Only failed webhook events can be manually redelivered",

            currentStatus:
              originalEvent.status,
          });
      }

      // ====================================================
      // CURRENT ENDPOINT CONFIGURATION
      // ====================================================

      const endpoint =
        await EndpointModel.findOne({
          endpointId:
            originalEvent.endpointId,

          projectId:
            originalEvent.projectId,

          createdBy:
            userId,
        });

      if (!endpoint) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Target endpoint no longer exists",
          });
      }

      if (!endpoint.active) {
        return res
          .status(409)
          .json({
            success:
              false,

            error:
              "Target endpoint is disabled",
          });
      }

      // ====================================================
      // CREATE NEW EVENT
      // ====================================================

      const newEventId =
        generateEventId();

      const queuedAt =
        new Date();

      const redeliveryEvent =
        await WebhookEventModel.create({
          eventId:
            newEventId,

          projectId:
            originalEvent.projectId,

          endpointId:
            originalEvent.endpointId,

          createdBy:
            originalEvent.createdBy,

          payload:
            originalEvent.payload,

          redeliveryOf:
            originalEvent.eventId,

          status:
            "queued",

          attemptCount:
            0,

          attempts:
            [],

          responseStatus:
            null,

          responseBody:
            null,

          latencyMs:
            null,

          error:
            null,

          queuedAt,

          processingStartedAt:
            null,

          completedAt:
            null,
        });

      // ====================================================
      // RETRY CONFIGURATION
      // ====================================================

      const maxRetries =
        Number.isInteger(
          endpoint.maxRetries
        )
          ? endpoint.maxRetries
          : 3;

      const totalAttempts =
        Math.max(
          1,
          maxRetries +
            1
        );

      // ====================================================
      // QUEUE
      // ====================================================

      try {
        const job =
          await webhookQueue.add(
            "deliver-webhook",

            {
              eventId:
                redeliveryEvent.eventId,

              endpointId:
                redeliveryEvent.endpointId,

              projectId:
                redeliveryEvent.projectId,

              userId,
            },

            {
              jobId:
                redeliveryEvent.eventId,

              attempts:
                totalAttempts,
            }
          );

        console.log(
          "===================================="
        );

        console.log(
          "🔁 Manual webhook redelivery queued"
        );

        console.log(
          "Original Event:",
          originalEvent.eventId
        );

        console.log(
          "New Event:",
          redeliveryEvent.eventId
        );

        console.log(
          "Project:",
          redeliveryEvent.projectId
        );

        console.log(
          "Endpoint:",
          redeliveryEvent.endpointId
        );

        console.log(
          "Max Retries:",
          maxRetries
        );

        console.log(
          "Total Attempts:",
          totalAttempts
        );

        console.log(
          "===================================="
        );

        return res
          .status(202)
          .json({
            success:
              true,

            message:
              "Webhook redelivery queued successfully",

            originalEventId:
              originalEvent.eventId,

            eventId:
              redeliveryEvent.eventId,

            redeliveryOf:
              originalEvent.eventId,

            projectId:
              redeliveryEvent.projectId,

            endpointId:
              redeliveryEvent.endpointId,

            jobId:
              job.id,

            status:
              "queued",

            maxRetries,

            totalAttempts,
          });
      } catch (queueError) {
        console.error(
          "Manual Redelivery Queue Error:",
          queueError
        );

        await WebhookEventModel.updateOne(
          {
            eventId:
              redeliveryEvent.eventId,
          },
          {
            $set: {
              status:
                "failed",

              error:
                "Failed to enqueue webhook redelivery",

              completedAt:
                new Date(),
            },
          }
        );

        return res
          .status(503)
          .json({
            success:
              false,

            originalEventId:
              originalEvent.eventId,

            eventId:
              redeliveryEvent.eventId,

            error:
              "Webhook queue is temporarily unavailable",
          });
      }
    } catch (error) {
      console.error(
        "Manual Webhook Redelivery Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to manually redeliver webhook",
        });
    }
  }
);

// ==========================================================
// GET SINGLE WEBHOOK EVENT
//
// GET /api/v1/events/:eventId
//
// IMPORTANT:
//
// Keep LAST among the event GET routes.
// ==========================================================

router.get(
  "/:eventId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      const rawEventId =
        req.params.eventId;

      const eventId =
        Array.isArray(
          rawEventId
        )
          ? rawEventId[0]
          : rawEventId;

      if (
        typeof eventId !==
          "string" ||
        !eventId.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Event ID is required",
          });
      }

      const normalizedEventId =
        eventId.trim();

      const event =
        await WebhookEventModel.findOne({
          eventId:
            normalizedEventId,

          createdBy:
            userId,
        }).lean();

      if (!event) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Webhook event not found",
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          event,
        });
    } catch (error) {
      console.error(
        "Get Webhook Event Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to fetch webhook event",
        });
    }
  }
);

// ==========================================================
// EXPORT
// ==========================================================

export default router;