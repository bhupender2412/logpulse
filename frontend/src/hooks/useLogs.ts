import { useCallback, useEffect, useState } from "react";
import {
  getLogs,
  type Log,
  type GetLogsParams,
} from "../api/logsApi";

interface UseLogsResult {
  logs: Log[];

  loading: boolean;

  error: string;

  page: number;

  total: number;

  totalPages: number;

  hasNextPage: boolean;

  hasPreviousPage: boolean;

  refresh: () => Promise<void>;

  setPage: (page: number) => void;
}

export default function useLogs(
  params: GetLogsParams = {}
): UseLogsResult {
  const [logs, setLogs] =
    useState<Log[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [page, setPageState] =
    useState(params.page ?? 1);

  const [total, setTotal] =
    useState(0);

  const [totalPages, setTotalPages] =
    useState(0);

  const [hasNextPage, setHasNextPage] =
    useState(false);

  const [
    hasPreviousPage,
    setHasPreviousPage,
  ] = useState(false);

  const fetchLogs = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getLogs({
          ...params,
          page,
        });

        // IMPORTANT:
        // getLogs() now returns LogsResponse,
        // so the actual log array is data.logs.
        setLogs(data.logs);

        setTotal(data.total);

        setTotalPages(
          data.totalPages
        );

        setHasNextPage(
          data.hasNextPage
        );

        setHasPreviousPage(
          data.hasPreviousPage
        );
      } catch (err) {
        console.error(
          "useLogs error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch logs"
        );

        setLogs([]);
        setTotal(0);
        setTotalPages(0);
        setHasNextPage(false);
        setHasPreviousPage(false);
      } finally {
        setLoading(false);
      }
    },
    [
      page,
      params.search,
      params.projectId,
      params.level,
      params.limit,
    ]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const setPage = (
    newPage: number
  ) => {
    if (newPage < 1) {
      return;
    }

    if (
      totalPages > 0 &&
      newPage > totalPages
    ) {
      return;
    }

    setPageState(newPage);
  };

  return {
    logs,
    loading,
    error,
    page,
    total,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    refresh: fetchLogs,
    setPage,
  };
}