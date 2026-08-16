const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://logpulse-api-1tla.onrender.com";

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
  metadata?: Record<string, unknown>;
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
// STATS
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
// GET LOGS
// ==========================================================

export interface GetLogsParams {
  page?: number;
  limit?: number;
  search?: string;
  projectId?: string;
  level?: string;
}

export async function getLogs(
  params: GetLogsParams = {}
): Promise<LogsResponse> {
  const query =
    new URLSearchParams();

  if (params.page !== undefined) {
    query.set(
      "page",
      String(params.page)
    );
  }

  if (params.limit !== undefined) {
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
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch logs: ${response.status}`
    );
  }

  const data =
    await response.json();

  if (!data.success) {
    throw new Error(
      "Backend returned an error while fetching logs"
    );
  }

  return data;
}

// ==========================================================
// GET STATS
// ==========================================================

export interface GetStatsParams {
  range?: TimeRange;
  search?: string;
  projectId?: string;
  level?: string;
}

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
    await fetch(
      `${API_URL}/api/v1/logs/stats?${query.toString()}`
    );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch log statistics: ${response.status}`
    );
  }

  const data =
    await response.json();

  if (!data.success) {
    throw new Error(
      "Backend returned an error while fetching statistics"
    );
  }

  return data;
}

// ==========================================================
// GET TIME SERIES
// ==========================================================

export interface GetTimeSeriesParams {
  range?: TimeRange;
  search?: string;
  projectId?: string;
  level?: string;
}

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
    await fetch(
      `${API_URL}/api/v1/logs/timeseries?${query.toString()}`
    );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch time-series data: ${response.status}`
    );
  }

  const data =
    await response.json();

  if (!data.success) {
    throw new Error(
      "Backend returned an error while fetching time-series data"
    );
  }

  return data;
}

// ==========================================================
// GET PROJECT STATS
// ==========================================================

export interface GetProjectStatsParams {
  range?: TimeRange;
  search?: string;
  projectId?: string;
  level?: string;
}

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
    await fetch(
      `${API_URL}/api/v1/logs/projects/stats?${query.toString()}`
    );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch project statistics: ${response.status}`
    );
  }

  const data =
    await response.json();

  if (!data.success) {
    throw new Error(
      "Backend returned an error while fetching project statistics"
    );
  }

  return data;
}

// ==========================================================
// GET PROJECT LOGS
// ==========================================================

export interface GetProjectLogsParams {
  projectId: string;
  page?: number;
  limit?: number;
}

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

  if (params.page !== undefined) {
    query.set(
      "page",
      String(params.page)
    );
  }

  if (params.limit !== undefined) {
    query.set(
      "limit",
      String(params.limit)
    );
  }

  const queryString =
    query.toString();

  const url =
    queryString.length > 0
      ? `${API_URL}/api/v1/logs/${encodeURIComponent(
          params.projectId
        )}?${queryString}`
      : `${API_URL}/api/v1/logs/${encodeURIComponent(
          params.projectId
        )}`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch project logs: ${response.status}`
    );
  }

  return response.json();
}

// ==========================================================
// SEND LOG
// ==========================================================

export interface SendLogPayload {
  projectId: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

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

        body: JSON.stringify(log),
      }
    );

  if (!response.ok) {
    throw new Error(
      "Failed to send log"
    );
  }

  return response.json();
}

// ==========================================================
// HEALTH
// ==========================================================

export async function getHealth() {
  const response =
    await fetch(
      `${API_URL}/api/health`
    );

  if (!response.ok) {
    throw new Error(
      `Health check failed: ${response.status}`
    );
  }

  return response.json();
}

// ==========================================================
// API URL
// ==========================================================

export { API_URL };