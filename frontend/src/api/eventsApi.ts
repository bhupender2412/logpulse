import {
  apiClient,
  getApiErrorMessage,
} from "./apiClient";

// ==========================================================
// TYPES
// ==========================================================

export type WebhookEventStatus =
  | "queued"
  | "processing"
  | "retrying"
  | "success"
  | "failed";

export type EventTimeRange =
  | "1h"
  | "6h"
  | "24h"
  | "7d"
  | "30d"
  | "all";

// ==========================================================
// DELIVERY ATTEMPT
// ==========================================================

export interface DeliveryAttempt {
  attempt: number;

  status:
    | "success"
    | "failed";

  statusCode:
    number | null;

  latencyMs:
    number | null;

  responseBody:
    unknown;

  error:
    string | null;

  timestamp:
    string;
}

// ==========================================================
// WEBHOOK EVENT
// ==========================================================

export interface WebhookEvent {
  _id:
    string;

  eventId:
    string;

  projectId:
    string;

  endpointId:
    string;

  createdBy:
    string;

  payload:
    unknown;

  redeliveryOf?:
    string | null;

  status:
    WebhookEventStatus;

  attemptCount:
    number;

  attempts:
    DeliveryAttempt[];

  responseStatus:
    number | null;

  responseBody:
    unknown;

  latencyMs:
    number | null;

  error:
    string | null;

  queuedAt:
    string;

  processingStartedAt:
    string | null;

  completedAt:
    string | null;

  createdAt:
    string;

  updatedAt:
    string;
}

// ==========================================================
// GET EVENTS RESPONSE
// ==========================================================

export interface EventsResponse {
  success:
    boolean;

  page:
    number;

  limit:
    number;

  total:
    number;

  totalPages:
    number;

  count:
    number;

  hasNextPage:
    boolean;

  hasPreviousPage:
    boolean;

  filters: {
    projectId:
      string;

    endpointId:
      string;

    status:
      string;
  };

  events:
    WebhookEvent[];
}

// ==========================================================
// EVENT STATS
// ==========================================================

export interface EventStatsResponse {
  success:
    boolean;

  filters: {
    projectId:
      string;

    endpointId:
      string;
  };

  total:
    number;

  queued:
    number;

  processing:
    number;

  retrying:
    number;

  successful:
    number;

  failed:
    number;

  completedDeliveries:
    number;

  successRate:
    number;

  failureRate:
    number;

  averageLatencyMs:
    number;
}

// ==========================================================
// TIME SERIES POINT
// ==========================================================

export interface EventTimeSeriesPoint {
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
}

// ==========================================================
// TIME SERIES RESPONSE
// ==========================================================

export interface EventTimeSeriesResponse {
  success:
    boolean;

  range:
    EventTimeRange;

  interval: {
    unit:
      | "minute"
      | "hour"
      | "day";

    binSize:
      number;
  };

  filters: {
    projectId:
      string;

    endpointId:
      string;
  };

  count:
    number;

  data:
    EventTimeSeriesPoint[];
}

// ==========================================================
// SINGLE EVENT RESPONSE
// ==========================================================

export interface EventDetailsResponse {
  success:
    boolean;

  event:
    WebhookEvent;
}

// ==========================================================
// REDELIVERY RESPONSE
// ==========================================================

export interface RedeliverResponse {
  success:
    boolean;

  message:
    string;

  originalEventId:
    string;

  eventId:
    string;

  redeliveryOf:
    string;

  projectId:
    string;

  endpointId:
    string;

  jobId:
    string;

  status:
    string;

  maxRetries:
    number;

  totalAttempts:
    number;
}

// ==========================================================
// REDELIVERY HISTORY
// ==========================================================

export interface RedeliverySummary {
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

  inProgress:
    number;
}

export interface RedeliveryHistoryResponse {
  success:
    boolean;

  eventId:
    string;

  sourceEvent:
    Partial<WebhookEvent>;

  summary:
    RedeliverySummary;

  count:
    number;

  redeliveries:
    WebhookEvent[];
}

// ==========================================================
// GET EVENTS PARAMS
// ==========================================================

export interface GetEventsParams {
  page?:
    number;

  limit?:
    number;

  projectId?:
    string;

  endpointId?:
    string;

  status?:
    WebhookEventStatus | "all";
}

// ==========================================================
// GET EVENTS
//
// GET /api/v1/events
// ==========================================================

export async function getEvents(
  params:
    GetEventsParams = {}
): Promise<EventsResponse> {
  try {
    const query =
      new URLSearchParams();

    if (
      params.page !==
      undefined
    ) {
      query.set(
        "page",
        String(
          params.page
        )
      );
    }

    if (
      params.limit !==
      undefined
    ) {
      query.set(
        "limit",
        String(
          params.limit
        )
      );
    }

    if (
      params.projectId &&
      params.projectId !==
        "all"
    ) {
      query.set(
        "projectId",
        params.projectId
      );
    }

    if (
      params.endpointId &&
      params.endpointId !==
        "all"
    ) {
      query.set(
        "endpointId",
        params.endpointId
      );
    }

    if (
      params.status &&
      params.status !==
        "all"
    ) {
      query.set(
        "status",
        params.status
      );
    }

    const queryString =
      query.toString();

    const url =
      queryString
        ? `/api/v1/events?${queryString}`
        : "/api/v1/events";

    const response =
      await apiClient.get<EventsResponse>(
        url
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to fetch webhook events"
      )
    );
  }
}

// ==========================================================
// GET EVENT STATISTICS
//
// GET /api/v1/events/stats
// ==========================================================

export async function getEventStats(
  params: {
    projectId?:
      string;

    endpointId?:
      string;
  } = {}
): Promise<EventStatsResponse> {
  try {
    const query =
      new URLSearchParams();

    if (
      params.projectId &&
      params.projectId !==
        "all"
    ) {
      query.set(
        "projectId",
        params.projectId
      );
    }

    if (
      params.endpointId &&
      params.endpointId !==
        "all"
    ) {
      query.set(
        "endpointId",
        params.endpointId
      );
    }

    const queryString =
      query.toString();

    const url =
      queryString
        ? `/api/v1/events/stats?${queryString}`
        : "/api/v1/events/stats";

    const response =
      await apiClient.get<EventStatsResponse>(
        url
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to fetch webhook statistics"
      )
    );
  }
}

// ==========================================================
// GET EVENT TIME SERIES
//
// GET /api/v1/events/timeseries
// ==========================================================

export async function getEventTimeSeries(
  params: {
    range?:
      EventTimeRange;

    projectId?:
      string;

    endpointId?:
      string;
  } = {}
): Promise<EventTimeSeriesResponse> {
  try {
    const query =
      new URLSearchParams();

    query.set(
      "range",
      params.range ||
        "24h"
    );

    if (
      params.projectId &&
      params.projectId !==
        "all"
    ) {
      query.set(
        "projectId",
        params.projectId
      );
    }

    if (
      params.endpointId &&
      params.endpointId !==
        "all"
    ) {
      query.set(
        "endpointId",
        params.endpointId
      );
    }

    const response =
      await apiClient.get<EventTimeSeriesResponse>(
        `/api/v1/events/timeseries?${query.toString()}`
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to fetch webhook time-series data"
      )
    );
  }
}

// ==========================================================
// GET SINGLE EVENT
//
// GET /api/v1/events/:eventId
// ==========================================================

export async function getEvent(
  eventId:
    string
): Promise<EventDetailsResponse> {
  try {
    const response =
      await apiClient.get<EventDetailsResponse>(
        `/api/v1/events/${encodeURIComponent(
          eventId
        )}`
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to fetch webhook event"
      )
    );
  }
}

// ==========================================================
// MANUAL REDELIVERY
//
// POST /api/v1/events/:eventId/redeliver
// ==========================================================

export async function redeliverEvent(
  eventId:
    string
): Promise<RedeliverResponse> {
  try {
    const response =
      await apiClient.post<RedeliverResponse>(
        `/api/v1/events/${encodeURIComponent(
          eventId
        )}/redeliver`
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to redeliver webhook event"
      )
    );
  }
}

// ==========================================================
// GET REDELIVERY HISTORY
//
// GET /api/v1/events/:eventId/redeliveries
// ==========================================================

export async function getRedeliveries(
  eventId:
    string
): Promise<RedeliveryHistoryResponse> {
  try {
    const response =
      await apiClient.get<RedeliveryHistoryResponse>(
        `/api/v1/events/${encodeURIComponent(
          eventId
        )}/redeliveries`
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Failed to fetch webhook redelivery history"
      )
    );
  }
}