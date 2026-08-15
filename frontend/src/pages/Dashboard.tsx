import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";

import LogsOverTimeChart, {
  type TimeSeriesPoint,
} from "../components/charts/LogsOverTimeChart";

interface LogEvent {
  id?: string;
  _id?: string;
  projectId: string;
  level:
    | "info"
    | "warn"
    | "error"
    | "fatal";
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  createdAt?: string;
}

interface LogsResponse {
  success: boolean;
  count: number;
  logs: LogEvent[];
}

type TimeRange =
  | "1h"
  | "6h"
  | "24h"
  | "7d"
  | "all";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://logpulse-api-1tla.onrender.com";

const socket: Socket = io(API_URL, {
  transports: ["websocket"],
});

export default function Dashboard() {
  const [logs, setLogs] = useState<LogEvent[]>(
    []
  );

  const [connected, setConnected] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [selectedLevel, setSelectedLevel] =
    useState("all");

  const [
    selectedProject,
    setSelectedProject,
  ] = useState("all");

  const [timeRange, setTimeRange] =
  useState<TimeRange>("7d");

  // ==========================================================
  // FETCH LOGS
  // ==========================================================

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/api/v1/logs`
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch logs: ${response.status}`
          );
        }

        const data: LogsResponse =
          await response.json();

        if (!data.success) {
          throw new Error(
            "Backend returned an error"
          );
        }

        setLogs(
          Array.isArray(data.logs)
            ? data.logs
            : []
        );
      } catch (err) {
        console.error(
          "Fetch Logs Error:",
          err
        );

        setError(
          "Unable to load logs from the backend."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

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
      newLog: LogEvent
    ) => {
      console.log(
        "📥 New Log:",
        newLog
      );

      setLogs((previousLogs) => {
        const newId =
          newLog.id ||
          newLog._id ||
          `${newLog.timestamp}-${newLog.projectId}-${newLog.message}`;

        const alreadyExists =
          previousLogs.some(
            (log) =>
              (log.id || log._id) ===
              newId
          );

        if (alreadyExists) {
          return previousLogs;
        }

        return [
          {
            ...newLog,
            id:
              newLog.id ||
              newLog._id ||
              newId,
          },
          ...previousLogs,
        ].slice(0, 100);
      });
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
  }, []);

  // ==========================================================
  // PROJECT LIST
  // ==========================================================

  const projects = useMemo(() => {
    const values = logs
      .map(
        (log) =>
          log.projectId
      )
      .filter(Boolean);

    return [
      "all",
      ...Array.from(
        new Set(values)
      ).sort(),
    ];
  }, [logs]);

  // ==========================================================
  // FILTER LOGS
  // ==========================================================

  const filteredLogs = useMemo(() => {
    const search =
      searchTerm
        .trim()
        .toLowerCase();

    return logs.filter((log) => {
      const matchesSearch =
        search === "" ||
        log.message
          .toLowerCase()
          .includes(search) ||
        log.projectId
          .toLowerCase()
          .includes(search) ||
        log.level
          .toLowerCase()
          .includes(search);

      const matchesLevel =
        selectedLevel === "all" ||
        log.level === selectedLevel;

      const matchesProject =
        selectedProject === "all" ||
        log.projectId ===
          selectedProject;

      return (
        matchesSearch &&
        matchesLevel &&
        matchesProject
      );
    });
  }, [
    logs,
    searchTerm,
    selectedLevel,
    selectedProject,
  ]);

  // ==========================================================
  // TIME RANGE
  // ==========================================================

  const timeRangeMs = useMemo(() => {
    switch (timeRange) {
      case "1h":
        return 60 * 60 * 1000;

      case "6h":
        return 6 * 60 * 60 * 1000;

      case "24h":
        return 24 * 60 * 60 * 1000;

      case "7d":
        return 7 * 24 * 60 * 60 * 1000;

      case "all":
      default:
        return 0;
    }
  }, [timeRange]);

  // ==========================================================
  // TIME-FILTERED LOGS
  // ==========================================================

  const timeFilteredLogs = useMemo(() => {
    if (timeRangeMs === 0) {
      return filteredLogs;
    }

    const cutoff =
      Date.now() - timeRangeMs;

    return filteredLogs.filter(
      (log) => {
        const timestamp = new Date(
          log.timestamp
        ).getTime();

        return (
          !Number.isNaN(timestamp) &&
          timestamp >= cutoff
        );
      }
    );
  }, [
    filteredLogs,
    timeRangeMs,
  ]);

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const stats = useMemo(() => {
    const total =
      timeFilteredLogs.length;

    const info =
      timeFilteredLogs.filter(
        (log) =>
          log.level === "info"
      ).length;

    const warn =
      timeFilteredLogs.filter(
        (log) =>
          log.level === "warn"
      ).length;

    const error =
      timeFilteredLogs.filter(
        (log) =>
          log.level === "error"
      ).length;

    const fatal =
      timeFilteredLogs.filter(
        (log) =>
          log.level === "fatal"
      ).length;

    const serious =
      error + fatal;

    const errorRate =
      total === 0
        ? 0
        : (serious / total) * 100;

    return {
      total,
      info,
      warn,
      error,
      fatal,
      errorRate,
    };
  }, [timeFilteredLogs]);

  // ==========================================================
  // PROJECT ACTIVITY
  // ==========================================================

  const projectActivity = useMemo(() => {
    const counts: Record<
      string,
      number
    > = {};

    timeFilteredLogs.forEach((log) => {
      counts[log.projectId] =
        (counts[log.projectId] || 0) +
        1;
    });

    return Object.entries(counts)
      .map(
        ([project, count]) => ({
          project,
          count,
        })
      )
      .sort(
        (a, b) =>
          b.count - a.count
      )
      .slice(0, 8);
  }, [timeFilteredLogs]);

  const maxProjectCount =
    projectActivity.length > 0
      ? Math.max(
          ...projectActivity.map(
            (item) =>
              item.count
          )
        )
      : 1;

  // ==========================================================
  // TIME-SERIES DATA
  // ==========================================================

  const timeSeriesData =
    useMemo<TimeSeriesPoint[]>(() => {
      if (
        timeFilteredLogs.length ===
        0
      ) {
        return [];
      }

      const now = new Date();

      let bucketCount = 24;

      let bucketSizeMs =
        60 * 60 * 1000;

      if (timeRange === "1h") {
        bucketCount = 12;
        bucketSizeMs =
          5 * 60 * 1000;
      }

      if (timeRange === "6h") {
        bucketCount = 12;
        bucketSizeMs =
          30 * 60 * 1000;
      }

      if (timeRange === "24h") {
        bucketCount = 24;
        bucketSizeMs =
          60 * 60 * 1000;
      }

      if (timeRange === "7d") {
        bucketCount = 14;
        bucketSizeMs =
          12 * 60 * 60 * 1000;
      }

      if (timeRange === "all") {
        const timestamps =
          timeFilteredLogs
            .map((log) =>
              new Date(
                log.timestamp
              ).getTime()
            )
            .filter((value) =>
              Number.isFinite(value)
            );

        if (
          timestamps.length ===
          0
        ) {
          return [];
        }

        const oldest =
          Math.min(...timestamps);

        const newest =
          Math.max(...timestamps);

        const duration =
          newest - oldest;

        if (
          duration <=
          24 * 60 * 60 * 1000
        ) {
          bucketCount = 24;
          bucketSizeMs =
            60 * 60 * 1000;
        } else {
          bucketCount = 14;
          bucketSizeMs = Math.max(
            Math.ceil(
              duration /
                bucketCount
            ),
            60 * 60 * 1000
          );
        }
      }

      const startTime =
        timeRange === "all"
          ? new Date(
              Math.min(
                ...timeFilteredLogs.map(
                  (log) =>
                    new Date(
                      log.timestamp
                    ).getTime()
                )
              )
            ).getTime()
          : now.getTime() -
            bucketCount *
              bucketSizeMs;

      const buckets =
        Array.from(
          {
            length:
              bucketCount,
          },
          (_, index) => {
            const bucketStart =
              startTime +
              index *
                bucketSizeMs;

            return {
              timestamp:
                bucketStart,
              label:
                formatBucketLabel(
                  bucketStart,
                  timeRange,
                  bucketCount
                ),
              info: 0,
              warn: 0,
              error: 0,
              fatal: 0,
            };
          }
        );

      timeFilteredLogs.forEach(
        (log) => {
          const timestamp =
            new Date(
              log.timestamp
            ).getTime();

          if (
            !Number.isFinite(
              timestamp
            )
          ) {
            return;
          }

          let bucketIndex =
            Math.floor(
              (timestamp -
                startTime) /
                bucketSizeMs
            );

          if (
            bucketIndex < 0
          ) {
            return;
          }

          if (
            bucketIndex >=
            bucketCount
          ) {
            bucketIndex =
              bucketCount - 1;
          }

          switch (log.level) {
            case "info":
              buckets[
                bucketIndex
              ].info++;
              break;

            case "warn":
              buckets[
                bucketIndex
              ].warn++;
              break;

            case "error":
              buckets[
                bucketIndex
              ].error++;
              break;

            case "fatal":
              buckets[
                bucketIndex
              ].fatal++;
              break;
          }
        }
      );

      return buckets.map(
        ({
          label,
          info,
          warn,
          error,
          fatal,
        }) => ({
          label,
          info,
          warn,
          error,
          fatal,
        })
      );
    }, [
      timeFilteredLogs,
      timeRange,
    ]);

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
  // BADGE
  // ==========================================================

  const getBadgeClass = (
    level: LogEvent["level"]
  ) => {
    switch (level) {
      case "error":
        return "bg-red-500/10 text-red-400 border-red-500/30";

      case "fatal":
        return "bg-red-700/20 text-red-300 border-red-700/40";

      case "warn":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";

      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    }
  };

  // ==========================================================
  // FILTER ACTIONS
  // ==========================================================

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedLevel("all");
    setSelectedProject("all");
  };

  const filtersActive =
    searchTerm.trim() !== "" ||
    selectedLevel !== "all" ||
    selectedProject !== "all";

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-black text-white p-6">

      {/* HEADER */}

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

      {/* ERROR */}

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">
          {error}
        </div>
      )}

      {/* FILTERS */}

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
              onChange={(event) =>
                setSelectedProject(
                  event.target.value
                )
              }
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none"
            >
              <option value="all">
                All Projects
              </option>

              {projects
                .filter(
                  (project) =>
                    project !== "all"
                )
                .map((project) => (
                  <option
                    key={project}
                    value={project}
                  >
                    {project}
                  </option>
                ))}
            </select>
          </div>

          {/* LEVEL */}

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Level
            </label>

            <select
              value={selectedLevel}
              onChange={(event) =>
                setSelectedLevel(
                  event.target.value
                )
              }
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
                  event.target.value as TimeRange
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
              {timeFilteredLogs.length}
            </span>{" "}
            of{" "}
            <span className="text-white font-semibold">
              {logs.length}
            </span>{" "}
            logs
          </div>

          <div className="flex gap-3">

            {filtersActive && (
              <span className="text-sm text-emerald-400 flex items-center">
                Filters active
              </span>
            )}

            <button
              onClick={clearFilters}
              disabled={!filtersActive}
              className={`px-4 py-2 rounded-lg transition ${
                filtersActive
                  ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                  : "bg-zinc-950 border border-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
            >
              Clear Filters
            </button>

          </div>

        </div>

      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">

        <StatCard
          title="Total Logs"
          value={stats.total}
          valueClass="text-white"
        />

        <StatCard
          title="Info"
          value={stats.info}
          valueClass="text-emerald-400"
        />

        <StatCard
          title="Warnings"
          value={stats.warn}
          valueClass="text-yellow-400"
        />

        <StatCard
          title="Errors"
          value={stats.error}
          valueClass="text-red-400"
        />

        <StatCard
          title="Fatal"
          value={stats.fatal}
          valueClass="text-red-300"
        />

      </div>

      {/* ======================================================
          LOGS OVER TIME
      ====================================================== */}

      <LogsOverTimeChart
        data={timeSeriesData}
      />

      {/* ======================================================
          SECONDARY ANALYTICS
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

          <div className="flex flex-col items-center justify-center mt-5">

            <div
              className="w-52 h-52 rounded-full flex items-center justify-center"
              style={{
                background:
                  pieGradient,
              }}
            >
              <div className="w-28 h-28 rounded-full bg-zinc-900 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">
                  {pieTotal}
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
              {stats.errorRate.toFixed(
                1
              )}
              %
            </div>

            <p className="text-gray-400 mt-4">
              serious logs
            </p>

            <p className="text-sm text-gray-600 mt-2">
              {stats.error +
                stats.fatal}{" "}
              out of {stats.total}
            </p>

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

          {projectActivity.length ===
          0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No project activity
            </div>
          ) : (
            <div className="space-y-4">

              {projectActivity.map(
                (item) => {
                  const percentage =
                    (item.count /
                      maxProjectCount) *
                    100;

                  return (
                    <div
                      key={item.project}
                    >
                      <div className="flex justify-between gap-3 mb-1">

                        <span
                          className="text-sm text-gray-300 truncate"
                          title={
                            item.project
                          }
                        >
                          {item.project}
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

      {/* STATUS */}

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
              Records Loaded
            </p>

            <p className="text-sm text-gray-300 mt-1">
              {logs.length}
            </p>
          </div>

        </div>

      </div>

      {/* LOG TABLE */}

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

          {loading ? (

            <div className="p-10 text-center text-gray-500">
              Loading logs...
            </div>

          ) : timeFilteredLogs.length ===
            0 ? (

            <div className="p-10 text-center">

              <p className="text-gray-400">
                No logs found for the selected filters and time range.
              </p>

              <button
                onClick={() => {
                  clearFilters();
                  setTimeRange("24h");
                }}
                className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
              >
                Reset Filters
              </button>

            </div>

          ) : (

            timeFilteredLogs.map(
              (log, index) => {

                const logId =
                  log.id ||
                  log._id ||
                  `${log.timestamp}-${index}`;

                return (
                  <div
                    key={logId}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 p-4 border-t border-zinc-800 hover:bg-zinc-900/50 transition"
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
  value: number;
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
// LEGEND ITEM
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

// ============================================================
// TIME BUCKET LABEL
// ============================================================

function formatBucketLabel(
  timestamp: number,
  timeRange: TimeRange,
  bucketCount: number
): string {
  const date = new Date(
    timestamp
  );

  if (timeRange === "7d") {
    return date.toLocaleDateString(
      [],
      {
        month: "short",
        day: "numeric",
      }
    );
  }

  if (
    timeRange === "all" &&
    bucketCount <= 14
  ) {
    return date.toLocaleDateString(
      [],
      {
        month: "short",
        day: "numeric",
      }
    );
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}