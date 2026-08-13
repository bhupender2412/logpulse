const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

export interface Log {
  _id: string;
  projectId: string;
  level: "info" | "warn" | "error" | "fatal";
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LogsResponse {
  success: boolean;
  count: number;
  logs: Log[];
}

export async function getLogs(): Promise<Log[]> {
  const response = await fetch(`${API_URL}/api/v1/logs`);

  if (!response.ok) {
    throw new Error("Failed to fetch logs");
  }

  const data: LogsResponse = await response.json();

  return data.logs;
}

export async function sendLog(
  log: Omit<Log, "_id" | "createdAt" | "updatedAt" | "timestamp">
) {
  const response = await fetch(`${API_URL}/api/v1/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(log),
  });

  if (!response.ok) {
    throw new Error("Failed to send log");
  }

  return response.json();
}