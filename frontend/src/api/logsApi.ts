import {
  getAuthHeaders,
} from "./authApi";

// ==========================================================
// API URL
// ==========================================================

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

// ==========================================================
// AUTHENTICATED FETCH
// ==========================================================

async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers =
    new Headers(options.headers);

  const authHeaders =
    getAuthHeaders();

  Object.entries(
    authHeaders
  ).forEach(
    ([key, value]) => {
      headers.set(
        key,
        value
      );
    }
  );

  return fetch(url, {
    ...options,
    headers,
  });
}

// ==========================================================
// TYPES
// ==========================================================

export type LogLevel =
  | "info"
  | "warn"
  | "error"
  | "fatal";

export type TimeRange =
  | "1h"
  | "6h"
  | "24h"
  | "7d"
  | "30d"
  | "all";

// ==========================================================
// LOG
// ==========================================================

export interface Log {
  _id: string;

  projectId: string;

  level: LogLevel;

  message: string;

  metadata?: Record<
    string,
    unknown
  >;

  timestamp: string;

  createdAt?: string;

  updatedAt?: string;
}

// ==========================================================
// LOG RESPONSE
// ==========================================================

export interface LogsResponse {
  success: boolean;

  page: number;

  limit: number;

  total: number;

  totalPages: number;

  count: number;

  hasNextPage: boolean;

  hasPreviousPage: boolean;

  filters?: {
    search: string;

    projectId: string;

    level: string;
  };

  logs: Log[];
}

// ==========================================================
// STATS RESPONSE
// ==========================================================

export interface LogStatsResponse {
  success: boolean;

  range: TimeRange;

  total: number;

  info: number;

  warn: number;

  error: number;

  fatal: number;

  errorRate: number;
}

// ==========================================================
// TIME SERIES
// ==========================================================

export interface TimeSeriesPoint {
  label: string;

  timestamp: string;

  info: number;

  warn: number;

  error: number;

  fatal: number;

  total: number;
}

export interface LogTimeSeriesResponse {
  success: boolean;

  range: TimeRange;

  interval: {
    unit:
      | "minute"
      | "hour"
      | "day";

    binSize: number;
  };

  count: number;

  data: TimeSeriesPoint[];
}

// ==========================================================
// PROJECT STATS
// ==========================================================

export interface ProjectStatsPoint {
  projectId: string;

  count: number;
}

export interface ProjectStatsResponse {
  success: boolean;

  range: TimeRange;

  count: number;

  total: number;

  data: ProjectStatsPoint[];
}

// ==========================================================
// GET LOGS PARAMS
// ==========================================================

export interface GetLogsParams {
  page?: number;

  limit?: number;

  search?: string;

  projectId?: string;

  level?: string;
}

// ==========================================================
// GET LOGS
// JWT PROTECTED
// ==========================================================

export async function getLogs(
  params: GetLogsParams = {}
): Promise<LogsResponse> {
  const query =
    new URLSearchParams();

  if (
    params.page !== undefined
  ) {
    query.set(
      "page",
      String(params.page)
    );
  }

  if (
    params.limit !== undefined
  ) {
    query.set(
      "limit",
      String(params.limit)
    );
  }

  if (
    params.search &&
    params.search.trim()
  ) {
    query.set(
      "search",
      params.search.trim()
    );
  }

  if (
    params.projectId &&
    params.projectId !== "all"
  ) {
    query.set(
      "projectId",
      params.projectId
    );
  }

  if (
    params.level &&
    params.level !== "all"
  ) {
    query.set(
      "level",
      params.level
    );
  }

  const queryString =
    query.toString();

  const url =
    queryString.length > 0
      ? `${API_URL}/api/v1/logs?${queryString}`
      : `${API_URL}/api/v1/logs`;

  const response =
    await authenticatedFetch(
      url
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Failed to fetch logs: ${response.status}`
    );
  }

  if (!data.success) {
    throw new Error(
      "Backend returned an error while fetching logs"
    );
  }

  return data;
}

// ==========================================================
// GET STATS PARAMS
// ==========================================================

export interface GetStatsParams {
  range?: TimeRange;

  search?: string;

  projectId?: string;

  level?: string;
}

// ==========================================================
// GET STATS
// JWT PROTECTED
// ==========================================================

export async function getLogStats(
  params: GetStatsParams = {}
): Promise<LogStatsResponse> {
  const query =
    new URLSearchParams();

  query.set(
    "range",
    params.range || "24h"
  );

  if (
    params.search &&
    params.search.trim()
  ) {
    query.set(
      "search",
      params.search.trim()
    );
  }

  if (
    params.projectId &&
    params.projectId !== "all"
  ) {
    query.set(
      "projectId",
      params.projectId
    );
  }

  if (
    params.level &&
    params.level !== "all"
  ) {
    query.set(
      "level",
      params.level
    );
  }

  const response =
    await authenticatedFetch(
      `${API_URL}/api/v1/logs/stats?${query.toString()}`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Failed to fetch log statistics: ${response.status}`
    );
  }

  if (!data.success) {
    throw new Error(
      "Backend returned an error while fetching statistics"
    );
  }

  return data;
}

// ==========================================================
// GET TIME SERIES PARAMS
// ==========================================================

export interface GetTimeSeriesParams {
  range?: TimeRange;

  search?: string;

  projectId?: string;

  level?: string;
}

// ==========================================================
// GET TIME SERIES
// JWT PROTECTED
// ==========================================================

export async function getLogTimeSeries(
  params: GetTimeSeriesParams = {}
): Promise<LogTimeSeriesResponse> {
  const query =
    new URLSearchParams();

  query.set(
    "range",
    params.range || "24h"
  );

  if (
    params.search &&
    params.search.trim()
  ) {
    query.set(
      "search",
      params.search.trim()
    );
  }

  if (
    params.projectId &&
    params.projectId !== "all"
  ) {
    query.set(
      "projectId",
      params.projectId
    );
  }

  if (
    params.level &&
    params.level !== "all"
  ) {
    query.set(
      "level",
      params.level
    );
  }

  const response =
    await authenticatedFetch(
      `${API_URL}/api/v1/logs/timeseries?${query.toString()}`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Failed to fetch time-series data: ${response.status}`
    );
  }

  if (!data.success) {
    throw new Error(
      "Backend returned an error while fetching time-series data"
    );
  }

  return data;
}

// ==========================================================
// GET PROJECT STATS PARAMS
// ==========================================================

export interface GetProjectStatsParams {
  range?: TimeRange;

  search?: string;

  projectId?: string;

  level?: string;
}

// ==========================================================
// GET PROJECT STATS
// JWT PROTECTED
// ==========================================================

export async function getProjectStats(
  params: GetProjectStatsParams = {}
): Promise<ProjectStatsResponse> {
  const query =
    new URLSearchParams();

  query.set(
    "range",
    params.range || "24h"
  );

  if (
    params.search &&
    params.search.trim()
  ) {
    query.set(
      "search",
      params.search.trim()
    );
  }

  if (
    params.projectId &&
    params.projectId !== "all"
  ) {
    query.set(
      "projectId",
      params.projectId
    );
  }

  if (
    params.level &&
    params.level !== "all"
  ) {
    query.set(
      "level",
      params.level
    );
  }

  const response =
    await authenticatedFetch(
      `${API_URL}/api/v1/logs/projects/stats?${query.toString()}`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Failed to fetch project statistics: ${response.status}`
    );
  }

  if (!data.success) {
    throw new Error(
      "Backend returned an error while fetching project statistics"
    );
  }

  return data;
}

// ==========================================================
// GET PROJECT LOGS PARAMS
// ==========================================================

export interface GetProjectLogsParams {
  projectId: string;

  page?: number;

  limit?: number;
}

// ==========================================================
// GET PROJECT LOGS
// JWT PROTECTED
// ==========================================================

export async function getProjectLogs(
  params: GetProjectLogsParams
): Promise<LogsResponse> {
  if (
    !params.projectId.trim()
  ) {
    throw new Error(
      "Project ID is required"
    );
  }

  const query =
    new URLSearchParams();

  if (
    params.page !== undefined
  ) {
    query.set(
      "page",
      String(params.page)
    );
  }

  if (
    params.limit !== undefined
  ) {
    query.set(
      "limit",
      String(params.limit)
    );
  }

  const queryString =
    query.toString();

  const encodedProjectId =
    encodeURIComponent(
      params.projectId
    );

  const url =
    queryString.length > 0
      ? `${API_URL}/api/v1/logs/${encodedProjectId}?${queryString}`
      : `${API_URL}/api/v1/logs/${encodedProjectId}`;

  const response =
    await authenticatedFetch(
      url
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Failed to fetch project logs: ${response.status}`
    );
  }

  if (!data.success) {
    throw new Error(
      "Backend returned an error while fetching project logs"
    );
  }

  return data;
}

// ==========================================================
// SEND LOG PAYLOAD
// ==========================================================

export interface SendLogPayload {
  projectId: string;

  level: LogLevel;

  message: string;

  metadata?: Record<
    string,
    unknown
  >;
}

// ==========================================================
// SEND LOG
//
// IMPORTANT:
// This route intentionally does NOT use the user's JWT.
//
// Later:
// POST /api/v1/logs will use a PROJECT API KEY instead.
// ==========================================================

export async function sendLog(
  log: SendLogPayload
) {
  const response =
    await fetch(
      `${API_URL}/api/v1/logs`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            log
          ),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "Failed to send log"
    );
  }

  return data;
}

// ==========================================================
// HEALTH CHECK
//
// PUBLIC ROUTE
// ==========================================================

export async function getHealth() {
  const response =
    await fetch(
      `${API_URL}/api/health`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        `Health check failed: ${response.status}`
    );
  }

  return data;
}

// ==========================================================
// EXPORT API URL
// ==========================================================

export { API_URL };