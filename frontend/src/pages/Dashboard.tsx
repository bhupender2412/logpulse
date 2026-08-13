import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";

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
  metadata?: Record<
    string,
    unknown
  >;
  timestamp: string;
  createdAt?: string;
}

interface LogsResponse {
  success: boolean;
  count: number;
  logs: LogEvent[];
}

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://logpulse-api-1tla.onrender.com";

const socket: Socket = io(API_URL, {
  transports: ["websocket"],
});

export default function Dashboard() {
  const [logs, setLogs] = useState<
    LogEvent[]
  >([]);

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

  // ==========================================================
  // FETCH EXISTING LOGS
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

        setLogs(data.logs);
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

        const normalizedLog: LogEvent = {
          ...newLog,
          id:
            newLog.id ||
            newLog._id ||
            newId,
        };

        return [
          normalizedLog,
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
    return [
      "all",
      ...Array.from(
        new Set(
          logs
            .map(
              (log) =>
                log.projectId
            )
            .filter(Boolean)
        )
      ).sort(),
    ];
  }, [logs]);

  // ==========================================================
  // FILTERED LOGS
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
        log.level ===
          selectedLevel;

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
  // STATISTICS
  // ==========================================================

  const stats = useMemo(() => {
    const total =
      filteredLogs.length;

    const info =
      filteredLogs.filter(
        (log) =>
          log.level === "info"
      ).length;

    const warn =
      filteredLogs.filter(
        (log) =>
          log.level === "warn"
      ).length;

    const error =
      filteredLogs.filter(
        (log) =>
          log.level === "error"
      ).length;

    const fatal =
      filteredLogs.filter(
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
  }, [filteredLogs]);

  // ==========================================================
  // PROJECT ACTIVITY
  // ==========================================================

  const projectActivity = useMemo(() => {
    const counts: Record<
      string,
      number
    > = {};

    filteredLogs.forEach((log) => {
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
  }, [filteredLogs]);

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
  // BADGE COLORS
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
  // CLEAR FILTERS
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
  // PIE CHART CALCULATIONS
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

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              disabled={!filtersActive}
              className={`w-full px-4 py-3 rounded-lg font-semibold transition ${
                filtersActive
                  ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                  : "bg-zinc-950 text-zinc-600 cursor-not-allowed border border-zinc-800"
              }`}
            >
              Clear Filters
            </button>
          </div>

        </div>

        <div className="flex flex-col md:flex-row md:justify-between gap-2 mt-4 text-sm text-gray-500">

          <span>
            Showing{" "}
            <span className="text-white font-semibold">
              {filteredLogs.length}
            </span>{" "}
            of{" "}
            <span className="text-white font-semibold">
              {logs.length}
            </span>{" "}
            logs
          </span>

          {filtersActive && (
            <span className="text-emerald-400">
              Filters active
            </span>
          )}

        </div>

      </div>

      {/* STAT CARDS */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">
            Total Logs
          </p>

          <h2 className="text-3xl font-bold mt-2">
            {stats.total}
          </h2>
        </div>

        <div className="bg-zinc-900 border border-emerald-900/40 rounded-xl p-5">
          <p className="text-gray-400 text-sm">
            Info
          </p>

          <h2 className="text-3xl font-bold text-emerald-400 mt-2">
            {stats.info}
          </h2>
        </div>

        <div className="bg-zinc-900 border border-yellow-900/40 rounded-xl p-5">
          <p className="text-gray-400 text-sm">
            Warnings
          </p>

          <h2 className="text-3xl font-bold text-yellow-400 mt-2">
            {stats.warn}
          </h2>
        </div>

        <div className="bg-zinc-900 border border-red-900/40 rounded-xl p-5">
          <p className="text-gray-400 text-sm">
            Errors
          </p>

          <h2 className="text-3xl font-bold text-red-400 mt-2">
            {stats.error}
          </h2>
        </div>

        <div className="bg-zinc-900 border border-red-900/40 rounded-xl p-5">
          <p className="text-gray-400 text-sm">
            Fatal
          </p>

          <h2 className="text-3xl font-bold text-red-300 mt-2">
            {stats.fatal}
          </h2>
        </div>

      </div>

      {/* ANALYTICS */}

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
              className="w-56 h-56 rounded-full flex items-center justify-center"
              style={{
                background:
                  pieGradient,
              }}
            >
              <div className="w-32 h-32 rounded-full bg-zinc-900 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">
                  {pieTotal}
                </span>

                <span className="text-xs text-gray-500">
                  Total
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-6">

              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />

                <span className="text-sm">
                  Info ({stats.info})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-400" />

                <span className="text-sm">
                  Warning ({stats.warn})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" />

                <span className="text-sm">
                  Error ({stats.error})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600" />

                <span className="text-sm">
                  Fatal ({stats.fatal})
                </span>
              </div>

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
              {stats.errorRate.toFixed(1)}%
            </div>

            <p className="text-gray-400 mt-4">
              serious logs
            </p>

            <p className="text-sm text-gray-600 mt-2">
              {stats.error +
                stats.fatal}{" "}
              out of{" "}
              {stats.total}
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

                        <span className="text-sm text-gray-500 shrink-0">
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

            <p className="text-sm text-gray-300 mt-1">
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

          ) : filteredLogs.length ===
            0 ? (

            <div className="p-10 text-center">

              <p className="text-gray-400">
                No logs found.
              </p>

              {filtersActive && (
                <button
                  onClick={
                    clearFilters
                  }
                  className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
                >
                  Clear Filters
                </button>
              )}

            </div>

          ) : (

            filteredLogs.map(
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