import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";

import LogDetailsModal from "../components/LogDetailsModal";

import {
  getLogStats,
  getLogTimeSeries,
  getLogs,
  getProjectStats,
  type Log,
  type LogLevel,
  type ProjectStatsPoint,
  type TimeRange,
  type TimeSeriesPoint,
} from "../api/logsApi";

import LogsOverTimeChart from "../components/charts/LogsOverTimeChart";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://logpulse-api-1tla.onrender.com";

const socket: Socket = io(API_URL, {
  transports: ["websocket"],
});

const PAGE_SIZE = 25;

interface DashboardStats {
  total: number;
  info: number;
  warn: number;
  error: number;
  fatal: number;
  errorRate: number;
}

const emptyStats: DashboardStats = {
  total: 0,
  info: 0,
  warn: 0,
  error: 0,
  fatal: 0,
  errorRate: 0,
};

export default function Dashboard() {
  // ==========================================================
  // SELECTED LOG
  // ==========================================================

  const [selectedLog, setSelectedLog] =
    useState<Log | null>(null);

  // ==========================================================
  // LOGS / PAGINATION
  // ==========================================================

  const [logs, setLogs] = useState<Log[]>([]);

  const [loadingLogs, setLoadingLogs] =
    useState(true);

  const [page, setPage] =
    useState(1);

  const [totalLogs, setTotalLogs] =
    useState(0);

  const [totalPages, setTotalPages] =
    useState(0);

  const [hasNextPage, setHasNextPage] =
    useState(false);

  const [
    hasPreviousPage,
    setHasPreviousPage,
  ] = useState(false);

  // ==========================================================
  // FILTERS
  // ==========================================================

  const [searchTerm, setSearchTerm] =
    useState("");

  const [
    selectedLevel,
    setSelectedLevel,
  ] = useState<LogLevel | "all">("all");

  const [
    selectedProject,
    setSelectedProject,
  ] = useState("all");

  const [timeRange, setTimeRange] =
    useState<TimeRange>("7d");

  // ==========================================================
  // ANALYTICS
  // ==========================================================

  const [stats, setStats] =
    useState<DashboardStats>(
      emptyStats
    );

  const [
    timeSeries,
    setTimeSeries,
  ] = useState<TimeSeriesPoint[]>([]);

  const [
    projectStats,
    setProjectStats,
  ] = useState<ProjectStatsPoint[]>([]);

  const [loadingStats, setLoadingStats] =
    useState(true);

  const [
    loadingTimeSeries,
    setLoadingTimeSeries,
  ] = useState(true);

  const [
    loadingProjectStats,
    setLoadingProjectStats,
  ] = useState(true);

  // ==========================================================
  // GENERAL
  // ==========================================================

  const [connected, setConnected] =
    useState(false);

  const [error, setError] =
    useState("");

  // ==========================================================
  // PROJECT LIST
  // ==========================================================

  const projects = useMemo(() => {
    return projectStats
      .map(
        (item) =>
          item.projectId
      )
      .filter(Boolean)
      .sort();
  }, [projectStats]);

  // ==========================================================
  // LOAD PAGINATED LOGS
  // ==========================================================

  const loadLogs = useCallback(
    async (
      requestedPage: number
    ) => {
      try {
        setLoadingLogs(true);
        setError("");

        const response =
          await getLogs({
            page: requestedPage,
            limit: PAGE_SIZE,
            search: searchTerm,
            projectId:
              selectedProject,
            level:
              selectedLevel,
          });

        setLogs(response.logs);

        setPage(response.page);

        setTotalLogs(
          response.total
        );

        setTotalPages(
          response.totalPages
        );

        setHasNextPage(
          response.hasNextPage
        );

        setHasPreviousPage(
          response.hasPreviousPage
        );
      } catch (err) {
        console.error(
          "Load Logs Error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load logs"
        );

        setLogs([]);
        setTotalLogs(0);
        setTotalPages(0);
        setHasNextPage(false);
        setHasPreviousPage(false);
      } finally {
        setLoadingLogs(false);
      }
    },
    [
      searchTerm,
      selectedProject,
      selectedLevel,
    ]
  );

  // ==========================================================
  // LOAD STATISTICS
  // ==========================================================

  const loadStats = useCallback(
    async () => {
      try {
        setLoadingStats(true);

        const response =
          await getLogStats({
            range: timeRange,
            search: searchTerm,
            projectId:
              selectedProject,
            level:
              selectedLevel,
          });

        setStats({
          total: response.total,
          info: response.info,
          warn: response.warn,
          error: response.error,
          fatal: response.fatal,
          errorRate:
            response.errorRate,
        });
      } catch (err) {
        console.error(
          "Load Stats Error:",
          err
        );

        setStats(emptyStats);
      } finally {
        setLoadingStats(false);
      }
    },
    [
      timeRange,
      searchTerm,
      selectedProject,
      selectedLevel,
    ]
  );

  // ==========================================================
  // LOAD TIME SERIES
  // ==========================================================

  const loadTimeSeries =
    useCallback(async () => {
      try {
        setLoadingTimeSeries(
          true
        );

        const response =
          await getLogTimeSeries({
            range: timeRange,
            search: searchTerm,
            projectId:
              selectedProject,
            level:
              selectedLevel,
          });

        setTimeSeries(
          response.data
        );
      } catch (err) {
        console.error(
          "Load Time Series Error:",
          err
        );

        setTimeSeries([]);
      } finally {
        setLoadingTimeSeries(
          false
        );
      }
    }, [
      timeRange,
      searchTerm,
      selectedProject,
      selectedLevel,
    ]);

  // ==========================================================
  // LOAD PROJECT STATISTICS
  // ==========================================================

  const loadProjectStats =
    useCallback(async () => {
      try {
        setLoadingProjectStats(
          true
        );

        const response =
          await getProjectStats({
            range: timeRange,
            search: searchTerm,
            projectId:
              selectedProject,
            level:
              selectedLevel,
          });

        setProjectStats(
          response.data
        );
      } catch (err) {
        console.error(
          "Load Project Stats Error:",
          err
        );

        setProjectStats([]);
      } finally {
        setLoadingProjectStats(
          false
        );
      }
    }, [
      timeRange,
      searchTerm,
      selectedProject,
      selectedLevel,
    ]);

  // ==========================================================
  // RESET TO PAGE 1 WHEN FILTERS CHANGE
  // ==========================================================

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    selectedProject,
    selectedLevel,
    timeRange,
  ]);

  // ==========================================================
  // LOAD LOGS WHEN PAGE CHANGES
  // ==========================================================

  useEffect(() => {
    void loadLogs(page);
  }, [page, loadLogs]);

  // ==========================================================
  // LOAD ANALYTICS WHEN FILTERS CHANGE
  // ==========================================================

  useEffect(() => {
    void loadStats();
    void loadTimeSeries();
    void loadProjectStats();
  }, [
    loadStats,
    loadTimeSeries,
    loadProjectStats,
  ]);

  // ==========================================================
  // SOCKET.IO
  // ==========================================================

  useEffect(() => {
    const handleConnect = () => {
      console.log(
        "✅ Socket Connected:",
        socket.id
      );

      setConnected(true);
    };

    const handleDisconnect = () => {
      console.log(
        "❌ Socket Disconnected"
      );

      setConnected(false);
    };

    const handleNewLog = (
      newLog: Log
    ) => {
      console.log(
        "📥 New Log:",
        newLog
      );

      setLogs((previousLogs) => {
        const exists =
          previousLogs.some(
            (log) =>
              log._id ===
              newLog._id
          );

        if (exists) {
          return previousLogs;
        }

        return [
          newLog,
          ...previousLogs,
        ].slice(
          0,
          PAGE_SIZE
        );
      });

      // Refresh backend-driven analytics.
      void loadStats();
      void loadTimeSeries();
      void loadProjectStats();

      // Refresh current page metadata.
      void loadLogs(page);
    };

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "log:new",
      handleNewLog
    );

    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "log:new",
        handleNewLog
      );
    };
  }, [
    loadLogs,
    loadStats,
    loadTimeSeries,
    loadProjectStats,
    page,
  ]);

  // ==========================================================
  // PROJECT ACTIVITY
  // ==========================================================

  const maxProjectCount =
    projectStats.length > 0
      ? Math.max(
          ...projectStats.map(
            (item) =>
              item.count
          )
        )
      : 1;

  // ==========================================================
  // CHART DATA
  // ==========================================================

  const chartData =
    useMemo(() => {
      return timeSeries.map(
        (item) => ({
          label: item.label,
          info: item.info,
          warn: item.warn,
          error: item.error,
          fatal: item.fatal,
        })
      );
    }, [timeSeries]);

  // ==========================================================
  // PIE CHART
  // ==========================================================

  const pieTotal =
    stats.info +
    stats.warn +
    stats.error +
    stats.fatal;

  const infoPercent =
    pieTotal === 0
      ? 0
      : (stats.info /
          pieTotal) *
        100;

  const warnPercent =
    pieTotal === 0
      ? 0
      : (stats.warn /
          pieTotal) *
        100;

  const errorPercent =
    pieTotal === 0
      ? 0
      : (stats.error /
          pieTotal) *
        100;

  const pieGradient =
    pieTotal === 0
      ? "#27272a"
      : `conic-gradient(
          #34d399 0% ${infoPercent}%,
          #facc15 ${infoPercent}% ${
            infoPercent +
            warnPercent
          }%,
          #f87171 ${
            infoPercent +
            warnPercent
          }% ${
            infoPercent +
            warnPercent +
            errorPercent
          }%,
          #dc2626 ${
            infoPercent +
            warnPercent +
            errorPercent
          }% 100%
        )`;

  // ==========================================================
  // LEVEL BADGE
  // ==========================================================

  const getBadgeClass = (
    level: LogLevel
  ) => {
    switch (level) {
      case "error":
        return "bg-red-500/10 text-red-400 border-red-500/30";

      case "fatal":
        return "bg-red-700/20 text-red-300 border-red-700/40";

      case "warn":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";

      case "info":
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    }
  };

  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedLevel("all");
    setSelectedProject("all");
    setTimeRange("7d");
    setPage(1);
  };

  const filtersActive =
    searchTerm.trim() !== "" ||
    selectedLevel !== "all" ||
    selectedProject !== "all" ||
    timeRange !== "7d";

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-black text-white p-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

        <div>
          <h1 className="text-4xl font-bold">
            🚀 LogPulse Console
          </h1>

          <p className="text-gray-400 mt-2">
            Real-Time Log Monitoring Dashboard
          </p>
        </div>

        <div
          className={`px-4 py-2 rounded-lg font-semibold border w-fit ${
            connected
              ? "bg-green-500/20 text-green-400 border-green-500/30"
              : "bg-red-500/20 text-red-400 border-red-500/30"
          }`}
        >
          {connected
            ? "🟢 LIVE"
            : "🔴 OFFLINE"}
        </div>

      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">
          {error}
        </div>
      )}

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

          {/* SEARCH */}

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Search Logs
            </label>

            <input
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              placeholder="Search message, project or level..."
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>

          {/* PROJECT */}

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Project
            </label>

            <select
              value={selectedProject}
              onChange={(event) => {
                setSelectedProject(
                  event.target.value
                );
                setPage(1);
              }}
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none"
            >
              <option value="all">
                All Projects
              </option>

              {projects.map(
                (project) => (
                  <option
                    key={project}
                    value={project}
                  >
                    {project}
                  </option>
                )
              )}
            </select>
          </div>

          {/* LEVEL */}

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Level
            </label>

            <select
              value={selectedLevel}
              onChange={(event) => {
                setSelectedLevel(
                  event.target.value as
                    | LogLevel
                    | "all"
                );
                setPage(1);
              }}
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none"
            >
              <option value="all">
                All Levels
              </option>

              <option value="info">
                INFO
              </option>

              <option value="warn">
                WARN
              </option>

              <option value="error">
                ERROR
              </option>

              <option value="fatal">
                FATAL
              </option>
            </select>
          </div>

          {/* TIME RANGE */}

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Time Range
            </label>

            <select
              value={timeRange}
              onChange={(event) =>
                setTimeRange(
                  event.target.value as
                    TimeRange
                )
              }
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none"
            >
              <option value="1h">
                Last 1 Hour
              </option>

              <option value="6h">
                Last 6 Hours
              </option>

              <option value="24h">
                Last 24 Hours
              </option>

              <option value="7d">
                Last 7 Days
              </option>

              <option value="30d">
                Last 30 Days
              </option>

              <option value="all">
                All Time
              </option>
            </select>
          </div>

        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4">

          <div className="text-sm text-gray-500">
            Showing{" "}
            <span className="text-white font-semibold">
              {logs.length}
            </span>{" "}
            logs on this page out of{" "}
            <span className="text-white font-semibold">
              {totalLogs}
            </span>{" "}
            matching logs
          </div>

          <div className="flex items-center gap-4">

            {filtersActive && (
              <span className="text-sm text-emerald-400">
                Filters active
              </span>
            )}

            <button
              onClick={
                clearFilters
              }
              disabled={
                !filtersActive
              }
              className={`px-4 py-2 rounded-lg font-semibold ${
                filtersActive
                  ? "bg-zinc-800 hover:bg-zinc-700"
                  : "bg-zinc-950 border border-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
            >
              Clear Filters
            </button>

          </div>

        </div>

      </div>

      {/* ======================================================
          STATS
      ====================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">

        <StatCard
          title="Total Logs"
          value={
            loadingStats
              ? "..."
              : stats.total
          }
          valueClass="text-white"
        />

        <StatCard
          title="Info"
          value={
            loadingStats
              ? "..."
              : stats.info
          }
          valueClass="text-emerald-400"
        />

        <StatCard
          title="Warnings"
          value={
            loadingStats
              ? "..."
              : stats.warn
          }
          valueClass="text-yellow-400"
        />

        <StatCard
          title="Errors"
          value={
            loadingStats
              ? "..."
              : stats.error
          }
          valueClass="text-red-400"
        />

        <StatCard
          title="Fatal"
          value={
            loadingStats
              ? "..."
              : stats.fatal
          }
          valueClass="text-red-300"
        />

      </div>

      {/* ======================================================
          LOGS OVER TIME
      ====================================================== */}

      <div className="mb-8">

        {loadingTimeSeries ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-[440px] flex items-center justify-center text-gray-500">
            Loading time-series data...
          </div>
        ) : (
          <LogsOverTimeChart
            data={chartData}
          />
        )}

      </div>

      {/* ======================================================
          ANALYTICS
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* LEVEL DISTRIBUTION */}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">

          <h2 className="text-2xl font-semibold">
            Level Distribution
          </h2>

          <p className="text-gray-400 mt-1">
            Logs by severity
          </p>

          <div className="flex flex-col items-center mt-5">

            <div
              className="w-52 h-52 rounded-full flex items-center justify-center"
              style={{
                background:
                  pieGradient,
              }}
            >
              <div className="w-28 h-28 rounded-full bg-zinc-900 flex flex-col items-center justify-center">

                <span className="text-2xl font-bold">
                  {loadingStats
                    ? "..."
                    : pieTotal}
                </span>

                <span className="text-xs text-gray-500">
                  Total
                </span>

              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-6 text-sm">

              <LegendItem
                label="Info"
                value={stats.info}
                dotClass="bg-emerald-400"
              />

              <LegendItem
                label="Warning"
                value={stats.warn}
                dotClass="bg-yellow-400"
              />

              <LegendItem
                label="Error"
                value={stats.error}
                dotClass="bg-red-400"
              />

              <LegendItem
                label="Fatal"
                value={stats.fatal}
                dotClass="bg-red-600"
              />

            </div>

          </div>

        </div>

        {/* ERROR RATE */}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col">

          <h2 className="text-2xl font-semibold">
            Error Rate
          </h2>

          <p className="text-gray-400 mt-1">
            Errors + Fatal logs
          </p>

          <div className="flex-1 flex flex-col items-center justify-center">

            <div className="text-7xl font-bold text-red-400">
              {loadingStats
                ? "..."
                : `${stats.errorRate.toFixed(
                    1
                  )}%`}
            </div>

            <p className="text-gray-400 mt-4">
              serious logs
            </p>

            {!loadingStats && (
              <p className="text-sm text-gray-600 mt-2">
                {stats.error +
                  stats.fatal}{" "}
                out of{" "}
                {stats.total}
              </p>
            )}

          </div>

        </div>

        {/* PROJECT ACTIVITY */}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">

          <h2 className="text-2xl font-semibold">
            Project Activity
          </h2>

          <p className="text-gray-400 mt-1 mb-5">
            Most active projects
          </p>

          {loadingProjectStats ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Loading project activity...
            </div>
          ) : projectStats.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No project activity
            </div>
          ) : (
            <div className="space-y-4">

              {projectStats.map(
                (item) => {
                  const percentage =
                    (item.count /
                      maxProjectCount) *
                    100;

                  return (
                    <div
                      key={
                        item.projectId
                      }
                    >

                      <div className="flex justify-between gap-3 mb-1">

                        <span
                          className="text-sm text-gray-300 truncate"
                          title={
                            item.projectId
                          }
                        >
                          {item.projectId}
                        </span>

                        <span className="text-sm text-gray-500">
                          {item.count}
                        </span>

                      </div>

                      <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">

                        <div
                          className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>

      </div>

      {/* ======================================================
          STATUS
      ====================================================== */}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-8">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Backend
            </p>

            <p className="text-sm text-gray-300 mt-1 break-all">
              {API_URL}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Socket
            </p>

            <p
              className={`mt-1 font-semibold ${
                connected
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {connected
                ? "Connected"
                : "Disconnected"}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Current Page
            </p>

            <p className="text-sm text-gray-300 mt-1">
              {logs.length} records
            </p>
          </div>

        </div>

      </div>

      {/* ======================================================
          LOG TABLE
      ====================================================== */}

      <div className="rounded-xl overflow-hidden border border-zinc-800">

        <div className="hidden md:grid grid-cols-12 gap-4 bg-zinc-900 p-4 font-semibold text-gray-300">

          <div className="col-span-2">
            Timestamp
          </div>

          <div className="col-span-2">
            Project
          </div>

          <div className="col-span-1">
            Level
          </div>

          <div className="col-span-7">
            Message
          </div>

        </div>

        <div className="max-h-[650px] overflow-y-auto">

          {loadingLogs ? (
            <div className="p-10 text-center text-gray-500">
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              No logs found.
            </div>
          ) : (
            logs.map(
              (log, index) => {
                const logId =
                  log._id ||
                  `${log.timestamp}-${log.projectId}-${index}`;

                return (
                  <div
                    key={logId}
                    onClick={() =>
                      setSelectedLog(
                        log
                      )
                    }
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 p-4 border-t border-zinc-800 hover:bg-zinc-900/50 transition cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                          "Enter" ||
                        event.key ===
                          " "
                      ) {
                        setSelectedLog(
                          log
                        );
                      }
                    }}
                  >

                    <div className="md:col-span-2">

                      <p className="md:hidden text-xs text-gray-600 mb-1">
                        Timestamp
                      </p>

                      <div className="text-sm text-gray-400">
                        {new Date(
                          log.timestamp
                        ).toLocaleString()}
                      </div>

                    </div>

                    <div className="md:col-span-2">

                      <p className="md:hidden text-xs text-gray-600 mb-1">
                        Project
                      </p>

                      <div
                        className="font-medium truncate"
                        title={
                          log.projectId
                        }
                      >
                        {log.projectId}
                      </div>

                    </div>

                    <div className="md:col-span-1">

                      <p className="md:hidden text-xs text-gray-600 mb-1">
                        Level
                      </p>

                      <span
                        className={`inline-block px-3 py-1 rounded-md border text-xs font-bold uppercase ${getBadgeClass(
                          log.level
                        )}`}
                      >
                        {log.level}
                      </span>

                    </div>

                    <div className="md:col-span-7">

                      <p className="md:hidden text-xs text-gray-600 mb-1">
                        Message
                      </p>

                      <div
                        className="truncate"
                        title={
                          log.message
                        }
                      >
                        {log.message}
                      </div>

                    </div>

                  </div>
                );
              }
            )
          )}

        </div>

      </div>

      {/* ======================================================
          PAGINATION
      ====================================================== */}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">

        <div className="text-sm text-gray-500">
          Page{" "}
          <span className="text-white font-semibold">
            {page}
          </span>{" "}
          of{" "}
          <span className="text-white font-semibold">
            {totalPages}
          </span>
        </div>

        <div className="flex items-center gap-3">

          <button
            onClick={() =>
              setPage(
                (current) =>
                  Math.max(
                    current - 1,
                    1
                  )
              )
            }
            disabled={
              !hasPreviousPage ||
              loadingLogs
            }
            className={`px-4 py-2 rounded-lg font-semibold ${
              hasPreviousPage &&
              !loadingLogs
                ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                : "bg-zinc-950 border border-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            ← Previous
          </button>

          <button
            onClick={() =>
              setPage(
                (current) =>
                  current + 1
              )
            }
            disabled={
              !hasNextPage ||
              loadingLogs
            }
            className={`px-4 py-2 rounded-lg font-semibold ${
              hasNextPage &&
              !loadingLogs
                ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                : "bg-zinc-950 border border-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            Next →
          </button>

        </div>

      </div>

      {/* ======================================================
          LOG DETAILS MODAL
      ====================================================== */}

      <LogDetailsModal
        log={selectedLog}
        onClose={() =>
          setSelectedLog(null)
        }
      />

      {/* FOOTER */}

      <div className="text-center text-gray-600 text-sm py-8">
        LogPulse • Real-Time Distributed Log Monitoring
      </div>

    </div>
  );
}

// ============================================================
// STAT CARD
// ============================================================

interface StatCardProps {
  title: string;
  value: number | string;
  valueClass: string;
}

function StatCard({
  title,
  value,
  valueClass,
}: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">

      <p className="text-gray-400 text-sm">
        {title}
      </p>

      <h2
        className={`text-3xl font-bold mt-2 ${valueClass}`}
      >
        {value}
      </h2>

    </div>
  );
}

// ============================================================
// LEGEND
// ============================================================

interface LegendItemProps {
  label: string;
  value: number;
  dotClass: string;
}

function LegendItem({
  label,
  value,
  dotClass,
}: LegendItemProps) {
  return (
    <div className="flex items-center gap-2">

      <span
        className={`w-3 h-3 rounded-full ${dotClass}`}
      />

      <span>
        {label} ({value})
      </span>

    </div>
  );
}