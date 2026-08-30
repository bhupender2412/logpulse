import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  Activity,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Server,
  Webhook,
  XCircle,
  Zap,
} from "lucide-react";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getEvents,
  getEventStats,
  getEventTimeSeries,
  type EventStatsResponse,
  type EventTimeRange,
  type EventTimeSeriesPoint,
  type WebhookEvent,
  type WebhookEventStatus,
} from "../api/eventsApi";

import {
  API_URL,
} from "../api/apiClient";

import EndpointManager from "../components/EndpointManager";

import ProjectManager from "../components/ProjectManager";

import WebhookEventDetailsModal from "../components/WebhookEventDetailsModal";

import {
  useAuth,
} from "../context/AuthContext";

import {
  connectSocket,
  socket,
} from "../socket/socket";

// ==========================================================
// CONSTANTS
// ==========================================================

const RECENT_EVENT_LIMIT =
  50;

// ==========================================================
// CONSOLE VIEW
// ==========================================================

type ConsoleView =
  | "dashboard"
  | "projects"
  | "endpoints";

// ==========================================================
// EMPTY STATS
// ==========================================================

const emptyStats: EventStatsResponse = {
  success:
    true,

  filters: {
    projectId:
      "all",

    endpointId:
      "all",
  },

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

  completedDeliveries:
    0,

  successRate:
    0,

  failureRate:
    0,

  averageLatencyMs:
    0,
};

// ==========================================================
// REALTIME EVENT TYPE
// ==========================================================

interface RealtimeWebhookEvent {
  eventId?:
    string;

  projectId?:
    string;

  endpointId?:
    string;

  status?:
    WebhookEventStatus;

  attempt?:
    number;

  statusCode?:
    number | null;

  latencyMs?:
    number | null;
}

// ==========================================================
// DASHBOARD
// ==========================================================

export default function Dashboard() {
  // ========================================================
  // AUTH
  // ========================================================

  const {
    user,
    logout,
  } =
    useAuth();

  const isDemo =
    user?.role ===
    "demo";

  // ========================================================
  // ACTIVE CONSOLE VIEW
  // ========================================================

  const [
    activeView,
    setActiveView,
  ] =
    useState<ConsoleView>(
      "dashboard"
    );

  // ========================================================
  // SELECTED WEBHOOK EVENT
  // ========================================================

  const [
    selectedEventId,
    setSelectedEventId,
  ] =
    useState<string | null>(
      null
    );

  // ========================================================
  // RANGE
  // ========================================================

  const [
    timeRange,
    setTimeRange,
  ] =
    useState<EventTimeRange>(
      "24h"
    );

  // ========================================================
  // STATISTICS
  // ========================================================

  const [
    stats,
    setStats,
  ] =
    useState<EventStatsResponse>(
      emptyStats
    );

  // ========================================================
  // TIME SERIES
  // ========================================================

  const [
    timeSeries,
    setTimeSeries,
  ] =
    useState<
      EventTimeSeriesPoint[]
    >(
      []
    );

  // ========================================================
  // RECENT EVENTS
  // ========================================================

  const [
    events,
    setEvents,
  ] =
    useState<
      WebhookEvent[]
    >(
      []
    );

  // ========================================================
  // UI STATE
  // ========================================================

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const [
    connected,
    setConnected,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  // ========================================================
  // CHANGE CONSOLE VIEW
  // ========================================================

  const changeView =
    (
      view:
        ConsoleView
    ) => {
      setSelectedEventId(
        null
      );

      setActiveView(
        view
      );
    };

  // ========================================================
  // LOAD DASHBOARD DATA
  // ========================================================

  const loadDashboard =
    useCallback(
      async (
        silent =
          false
      ) => {
        try {
          if (silent) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

          setError(
            ""
          );

          // ==================================================
          // LOAD DASHBOARD DATA IN PARALLEL
          // ==================================================

          const [
            statsResponse,
            timeSeriesResponse,
            eventsResponse,
          ] =
            await Promise.all([
              getEventStats(),

              getEventTimeSeries({
                range:
                  timeRange,
              }),

              getEvents({
                page:
                  1,

                limit:
                  RECENT_EVENT_LIMIT,
              }),
            ]);

          // ==================================================
          // STATS
          // ==================================================

          setStats(
            statsResponse
          );

          // ==================================================
          // TIME SERIES
          // ==================================================

          setTimeSeries(
            Array.isArray(
              timeSeriesResponse.data
            )
              ? timeSeriesResponse.data
              : []
          );

          // ==================================================
          // EVENTS
          // ==================================================

          setEvents(
            Array.isArray(
              eventsResponse.events
            )
              ? eventsResponse.events
              : []
          );
        } catch (err) {
          console.error(
            "PulseEngine Dashboard Error:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load PulseEngine dashboard"
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      [
        timeRange,
      ]
    );

  // ========================================================
  // INITIAL LOAD + RANGE CHANGE
  // ========================================================

  useEffect(
    () => {
      void loadDashboard();
    },
    [
      loadDashboard,
    ]
  );

  // ========================================================
  // SOCKET.IO REALTIME
  // ========================================================

  useEffect(
    () => {
      // ====================================================
      // CONNECTED
      // ====================================================

      const handleConnect =
        () => {
          console.log(
            "✅ PulseEngine Socket Connected:",
            socket.id
          );

          setConnected(
            true
          );
        };

      // ====================================================
      // DISCONNECTED
      // ====================================================

      const handleDisconnect =
        () => {
          console.log(
            "❌ PulseEngine Socket Disconnected"
          );

          setConnected(
            false
          );
        };

      // ====================================================
      // CONNECTION ERROR
      // ====================================================

      const handleConnectError =
        (
          socketError:
            Error
        ) => {
          console.error(
            "❌ PulseEngine Socket Error:",
            socketError.message
          );

          setConnected(
            false
          );
        };

      // ====================================================
      // WEBHOOK REALTIME EVENT
      // ====================================================

      const handleWebhookEvent =
        (
          realtimeEvent:
            RealtimeWebhookEvent
        ) => {
          console.log(
            "📡 PulseEngine Realtime Event:",
            realtimeEvent
          );

          void loadDashboard(
            true
          );
        };

      // ====================================================
      // REGISTER LISTENERS
      // ====================================================

      socket.on(
        "connect",
        handleConnect
      );

      socket.on(
        "disconnect",
        handleDisconnect
      );

      socket.on(
        "connect_error",
        handleConnectError
      );

      socket.on(
        "webhook:event",
        handleWebhookEvent
      );

      // ====================================================
      // JWT AUTHENTICATED CONNECTION
      // ====================================================

      connectSocket();

      if (
        socket.connected
      ) {
        setConnected(
          true
        );
      }

      // ====================================================
      // CLEANUP
      // ====================================================

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
          "connect_error",
          handleConnectError
        );

        socket.off(
          "webhook:event",
          handleWebhookEvent
        );
      };
    },
    [
      loadDashboard,
    ]
  );

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ====================================================
          TOP HEADER
      ==================================================== */}

      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sticky top-0 z-40">

        <div className="max-w-[1600px] mx-auto px-5 md:px-8 py-4">

          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">

            {/* ================================================
                BRAND
            ================================================ */}

            <div className="flex items-center gap-3 shrink-0">

              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">

                <Zap
                  size={
                    23
                  }
                  className="text-emerald-400"
                />

              </div>

              <div>

                <div className="flex items-center gap-2">

                  <h1 className="text-xl font-bold text-white">
                    PulseEngine
                  </h1>

                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
                    Console
                  </span>

                  {isDemo && (
                    <span className="inline-flex px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">
                      Demo Mode
                    </span>
                  )}

                </div>

                <p className="text-sm text-zinc-500">
                  Reliable Webhook Delivery Platform
                </p>

              </div>

            </div>

            {/* ================================================
                CONSOLE NAVIGATION
            ================================================ */}

            <nav className="flex items-center gap-1 bg-black border border-zinc-800 rounded-xl p-1 overflow-x-auto">

              <ConsoleNavButton
                label="Dashboard"
                active={
                  activeView ===
                  "dashboard"
                }
                onClick={() =>
                  changeView(
                    "dashboard"
                  )
                }
              />

              <ConsoleNavButton
                label="Projects"
                active={
                  activeView ===
                  "projects"
                }
                onClick={() =>
                  changeView(
                    "projects"
                  )
                }
              />

              <ConsoleNavButton
                label="Endpoints"
                active={
                  activeView ===
                  "endpoints"
                }
                onClick={() =>
                  changeView(
                    "endpoints"
                  )
                }
              />

            </nav>

            {/* ================================================
                USER AREA
            ================================================ */}

            <div className="flex flex-wrap items-center gap-3 shrink-0">

              {/* REALTIME STATUS */}

              <div
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${
                  connected
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >

                <span
                  className={`w-2 h-2 rounded-full ${
                    connected
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                />

                {connected
                  ? "Live"
                  : "Offline"}

              </div>

              {/* USER */}

              <div className="hidden sm:block text-right px-2">

                <p className="text-sm font-medium text-zinc-200">
                  {user?.name ||
                    "User"}
                </p>

                <p className="text-xs text-zinc-600">
                  {user?.email ||
                    ""}
                </p>

              </div>

              {/* LOGOUT */}

              <button
                type="button"
                onClick={
                  logout
                }
                className="px-4 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
              >
                Logout
              </button>

            </div>

          </div>

        </div>

      </header>

      {/* ====================================================
          DASHBOARD VIEW
      ==================================================== */}

      {activeView ===
      "dashboard" ? (

        <main className="max-w-[1600px] mx-auto px-5 md:px-8 py-8">

          {/* ==================================================
              PAGE HEADING
          ================================================== */}

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">

            <div>

              <p className="text-emerald-400 text-xs font-semibold tracking-[0.18em] mb-2">
                DELIVERY OVERVIEW
              </p>

              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Webhook Monitoring
              </h2>

              <p className="text-zinc-500 mt-2 max-w-2xl">
                Monitor webhook delivery health, retry activity,
                response latency and execution status in real time.
              </p>

            </div>

            {/* ================================================
                RANGE + REFRESH
            ================================================ */}

            <div className="flex flex-wrap items-center gap-3">

              <select
                value={
                  timeRange
                }
                onChange={(
                  event
                ) => {
                  setTimeRange(
                    event.target
                      .value as EventTimeRange
                  );
                }}
                className="h-11 bg-zinc-950 border border-zinc-700 rounded-lg px-4 text-sm text-zinc-300 outline-none focus:border-emerald-500 transition"
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

              <button
                type="button"
                onClick={() =>
                  void loadDashboard(
                    true
                  )
                }
                disabled={
                  refreshing
                }
                className="h-11 px-4 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 disabled:opacity-60 transition flex items-center gap-2 text-sm"
              >

                <RefreshCw
                  size={
                    16
                  }
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                {refreshing
                  ? "Refreshing"
                  : "Refresh"}

              </button>

            </div>

          </div>

          {/* ==================================================
              DEMO MODE NOTICE
          ================================================== */}

          {isDemo && (
            <div className="mb-6 px-5 py-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                <div>

                  <p className="text-sm font-medium text-cyan-400">
                    Demo Mode
                  </p>

                  <p className="text-sm text-zinc-500 mt-1">
                    You are viewing preloaded webhook delivery data in a
                    read-only environment.
                  </p>

                </div>

                <span className="inline-flex self-start sm:self-auto px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
                  Administrative actions disabled
                </span>

              </div>

            </div>
          )}

          {/* ==================================================
              ERROR
          ================================================== */}

          {error && (
            <div className="mb-6 px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">

              <div className="flex items-center gap-3">

                <XCircle
                  size={
                    19
                  }
                />

                <span>
                  {error}
                </span>

              </div>

            </div>
          )}

          {/* ==================================================
              MAIN METRIC CARDS
          ================================================== */}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">

            <MetricCard
              title="Total Deliveries"
              value={
                loading
                  ? "..."
                  : stats.total
              }
              subtitle="Webhook events"
              icon={
                <Webhook
                  size={
                    21
                  }
                />
              }
              iconClass="text-violet-400"
            />

            <MetricCard
              title="Successful"
              value={
                loading
                  ? "..."
                  : stats.successful
              }
              subtitle={`${stats.completedDeliveries} completed`}
              icon={
                <CheckCircle2
                  size={
                    21
                  }
                />
              }
              iconClass="text-emerald-400"
            />

            <MetricCard
              title="Failed"
              value={
                loading
                  ? "..."
                  : stats.failed
              }
              subtitle={`${stats.retrying} currently retrying`}
              icon={
                <XCircle
                  size={
                    21
                  }
                />
              }
              iconClass="text-red-400"
            />

            <MetricCard
              title="Success Rate"
              value={
                loading
                  ? "..."
                  : `${stats.successRate.toFixed(
                      2
                    )}%`
              }
              subtitle={`${stats.failureRate.toFixed(
                2
              )}% failure rate`}
              icon={
                <Activity
                  size={
                    21
                  }
                />
              }
              iconClass="text-cyan-400"
            />

            <MetricCard
              title="Avg Latency"
              value={
                loading
                  ? "..."
                  : `${stats.averageLatencyMs.toFixed(
                      2
                    )} ms`
              }
              subtitle="Latest response latency"
              icon={
                <Clock3
                  size={
                    21
                  }
                />
              }
              iconClass="text-amber-400"
            />

          </div>

          {/* ==================================================
              DELIVERY PERFORMANCE CHART
          ================================================== */}

          <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-8">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">

              <div>

                <h3 className="text-lg font-semibold text-zinc-100">
                  Delivery Performance
                </h3>

                <p className="text-sm text-zinc-500 mt-1">
                  Successful, failed and retrying webhook deliveries
                </p>

              </div>

              <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500">
                Range: {timeRange}
              </div>

            </div>

            {loading ? (
              <div className="h-[380px] flex items-center justify-center text-zinc-600">
                Loading delivery analytics...
              </div>
            ) : timeSeries.length ===
              0 ? (
              <div className="h-[380px] flex flex-col items-center justify-center text-zinc-600">

                <Activity
                  size={
                    38
                  }
                  className="mb-3 opacity-50"
                />

                <p>
                  No delivery analytics available
                </p>

              </div>
            ) : (
              <div className="h-[380px]">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <LineChart
                    data={
                      timeSeries
                    }
                    margin={{
                      top:
                        10,

                      right:
                        20,

                      left:
                        -10,

                      bottom:
                        0,
                    }}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#27272a"
                      vertical={
                        false
                      }
                    />

                    <XAxis
                      dataKey="label"
                      stroke="#71717a"
                      tickLine={
                        false
                      }
                      axisLine={{
                        stroke:
                          "#27272a",
                      }}
                      tick={{
                        fontSize:
                          11,
                      }}
                    />

                    <YAxis
                      allowDecimals={
                        false
                      }
                      stroke="#71717a"
                      tickLine={
                        false
                      }
                      axisLine={
                        false
                      }
                      tick={{
                        fontSize:
                          11,
                      }}
                    />

                    <Tooltip
                      cursor={{
                        stroke:
                          "#52525b",

                        strokeDasharray:
                          "4 4",
                      }}
                      contentStyle={{
                        background:
                          "#18181b",

                        border:
                          "1px solid #3f3f46",

                        borderRadius:
                          "10px",

                        color:
                          "#f4f4f5",

                        boxShadow:
                          "0 10px 30px rgba(0,0,0,0.35)",
                      }}
                      labelStyle={{
                        color:
                          "#a1a1aa",

                        marginBottom:
                          "6px",
                      }}
                    />

                    <Legend
                      wrapperStyle={{
                        fontSize:
                          "12px",

                        paddingTop:
                          "18px",
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="successful"
                      name="Successful"
                      stroke="#34d399"
                      strokeWidth={
                        2.5
                      }
                      dot={
                        false
                      }
                      activeDot={{
                        r:
                          5,
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="failed"
                      name="Failed"
                      stroke="#f87171"
                      strokeWidth={
                        2.5
                      }
                      dot={
                        false
                      }
                      activeDot={{
                        r:
                          5,
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="retrying"
                      name="Retrying"
                      stroke="#fbbf24"
                      strokeWidth={
                        2
                      }
                      dot={
                        false
                      }
                    />

                  </LineChart>

                </ResponsiveContainer>

              </div>
            )}

          </section>

          {/* ==================================================
              ANALYTICS GRID
          ================================================== */}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

            {/* ================================================
                DELIVERY HEALTH
            ================================================ */}

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">

              <div className="mb-6">

                <h3 className="text-lg font-semibold">
                  Delivery Health
                </h3>

                <p className="text-sm text-zinc-500 mt-1">
                  Current webhook lifecycle status
                </p>

              </div>

              <div className="space-y-5">

                <HealthRow
                  label="Queued"
                  value={
                    stats.queued
                  }
                  valueClass="text-blue-400"
                />

                <HealthRow
                  label="Processing"
                  value={
                    stats.processing
                  }
                  valueClass="text-indigo-400"
                />

                <HealthRow
                  label="Retrying"
                  value={
                    stats.retrying
                  }
                  valueClass="text-amber-400"
                />

                <div className="border-t border-zinc-800" />

                <HealthRow
                  label="Successful"
                  value={
                    stats.successful
                  }
                  valueClass="text-emerald-400"
                />

                <HealthRow
                  label="Failed"
                  value={
                    stats.failed
                  }
                  valueClass="text-red-400"
                />

              </div>

            </section>

            {/* ================================================
                ENGINE STATUS
            ================================================ */}

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">

              <div className="mb-6">

                <h3 className="text-lg font-semibold">
                  Engine Status
                </h3>

                <p className="text-sm text-zinc-500 mt-1">
                  PulseEngine runtime connectivity
                </p>

              </div>

              <div className="space-y-5">

                <SystemRow
                  icon={
                    <Server
                      size={
                        18
                      }
                    />
                  }
                  label="API Server"
                  value="Connected"
                  valueClass="text-emerald-400"
                />

                <SystemRow
                  icon={
                    <Activity
                      size={
                        18
                      }
                    />
                  }
                  label="Realtime Socket"
                  value={
                    connected
                      ? "Connected"
                      : "Disconnected"
                  }
                  valueClass={
                    connected
                      ? "text-emerald-400"
                      : "text-red-400"
                  }
                />

                <SystemRow
                  icon={
                    <Zap
                      size={
                        18
                      }
                    />
                  }
                  label="Delivery Engine"
                  value="Active"
                  valueClass="text-emerald-400"
                />

                <SystemRow
                  icon={
                    <Webhook
                      size={
                        18
                      }
                    />
                  }
                  label="Webhook Queue"
                  value="Operational"
                  valueClass="text-emerald-400"
                />

              </div>

              <div className="mt-7 pt-5 border-t border-zinc-800">

                <p className="text-[11px] uppercase tracking-widest text-zinc-600 mb-2">
                  API Endpoint
                </p>

                <p className="text-sm text-zinc-400 break-all font-mono">
                  {API_URL}
                </p>

              </div>

            </section>

            {/* ================================================
                PERFORMANCE
            ================================================ */}

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">

              <div className="mb-6">

                <h3 className="text-lg font-semibold">
                  Performance
                </h3>

                <p className="text-sm text-zinc-500 mt-1">
                  Delivery reliability metrics
                </p>

              </div>

              {/* SUCCESS RATE */}

              <div className="mb-7">

                <div className="flex items-center justify-between mb-2">

                  <span className="text-sm text-zinc-400">
                    Success Rate
                  </span>

                  <span className="font-semibold text-emerald-400">

                    {stats.successRate.toFixed(
                      2
                    )}
                    %

                  </span>

                </div>

                <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">

                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{
                      width:
                        `${Math.max(
                          0,
                          Math.min(
                            stats.successRate,
                            100
                          )
                        )}%`,
                    }}
                  />

                </div>

              </div>

              {/* BOXES */}

              <div className="grid grid-cols-2 gap-4">

                <PerformanceBox
                  label="Completed"
                  value={
                    stats.completedDeliveries
                  }
                />

                <PerformanceBox
                  label="Avg Latency"
                  value={`${Math.round(
                    stats.averageLatencyMs
                  )} ms`}
                />

                <PerformanceBox
                  label="Failure Rate"
                  value={`${stats.failureRate.toFixed(
                    1
                  )}%`}
                  valueClass="text-red-400"
                />

                <PerformanceBox
                  label="In Progress"
                  value={
                    stats.queued +
                    stats.processing +
                    stats.retrying
                  }
                  valueClass="text-amber-400"
                />

              </div>

            </section>

          </div>

          {/* ==================================================
              RECENT WEBHOOK EVENTS
          ================================================== */}

          <section className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">

            {/* TABLE TITLE */}

            <div className="px-5 md:px-6 py-5 border-b border-zinc-800">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <h3 className="text-lg font-semibold">
                    Recent Webhook Deliveries
                  </h3>

                  <p className="text-sm text-zinc-500 mt-1">
                    Click any delivery to inspect its payload,
                    response and attempt history.
                  </p>

                </div>

                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">

                  <Webhook
                    size={
                      19
                    }
                  />

                </div>

              </div>

            </div>

            {/* TABLE HEADER */}

            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-zinc-900/70 text-[11px] uppercase tracking-wider font-semibold text-zinc-500">

              <div className="col-span-3">
                Event ID
              </div>

              <div className="col-span-2">
                Project
              </div>

              <div className="col-span-2">
                Status
              </div>

              <div className="col-span-1">
                HTTP
              </div>

              <div className="col-span-1 text-center">
                Attempts
              </div>

              <div className="col-span-1">
                Latency
              </div>

              <div className="col-span-2">
                Created
              </div>

            </div>

            {/* TABLE BODY */}

            {loading ? (
              <div className="p-12 text-center text-zinc-600">

                <RefreshCw
                  size={
                    25
                  }
                  className="animate-spin mx-auto mb-3"
                />

                Loading recent deliveries...

              </div>
            ) : events.length ===
              0 ? (
              <div className="p-12 text-center">

                <Webhook
                  size={
                    38
                  }
                  className="mx-auto text-zinc-700 mb-4"
                />

                <p className="text-zinc-400 font-medium">
                  No webhook deliveries found
                </p>

                <p className="text-sm text-zinc-600 mt-1">
                  Dispatch a webhook event and it will appear here.
                </p>

              </div>
            ) : (
              <div>

                {events.map(
                  (
                    event
                  ) => (
                    <div
                      key={
                        event.eventId
                      }
                      role="button"
                      tabIndex={
                        0
                      }
                      onClick={() =>
                        setSelectedEventId(
                          event.eventId
                        )
                      }
                      onKeyDown={(
                        keyboardEvent
                      ) => {
                        if (
                          keyboardEvent.key ===
                            "Enter" ||
                          keyboardEvent.key ===
                            " "
                        ) {
                          keyboardEvent.preventDefault();

                          setSelectedEventId(
                            event.eventId
                          );
                        }
                      }}
                      className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 px-5 md:px-6 py-4 border-t border-zinc-800/80 hover:bg-zinc-900/70 focus:bg-zinc-900/70 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-emerald-500/40 transition cursor-pointer"
                    >

                      {/* EVENT */}

                      <div className="lg:col-span-3 min-w-0">

                        <p className="lg:hidden text-[11px] uppercase tracking-wide text-zinc-600 mb-1">
                          Event
                        </p>

                        <p
                          className="font-mono text-sm text-zinc-300 truncate"
                          title={
                            event.eventId
                          }
                        >
                          {event.eventId}
                        </p>

                        {event.redeliveryOf && (
                          <div className="mt-1">

                            <span className="inline-flex px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] border border-indigo-500/20 uppercase font-semibold">
                              Redelivery
                            </span>

                          </div>
                        )}

                      </div>

                      {/* PROJECT */}

                      <div className="lg:col-span-2 min-w-0">

                        <p className="lg:hidden text-[11px] uppercase tracking-wide text-zinc-600 mb-1">
                          Project
                        </p>

                        <p
                          className="text-sm text-zinc-300 truncate"
                          title={
                            event.projectId
                          }
                        >
                          {event.projectId}
                        </p>

                      </div>

                      {/* STATUS */}

                      <div className="lg:col-span-2">

                        <p className="lg:hidden text-[11px] uppercase tracking-wide text-zinc-600 mb-1">
                          Status
                        </p>

                        <StatusBadge
                          status={
                            event.status
                          }
                        />

                      </div>

                      {/* HTTP */}

                      <div className="lg:col-span-1">

                        <p className="lg:hidden text-[11px] uppercase tracking-wide text-zinc-600 mb-1">
                          HTTP
                        </p>

                        <span
                          className={`font-mono text-sm ${
                            event.responseStatus !==
                              null &&
                            event.responseStatus >=
                              200 &&
                            event.responseStatus <
                              300
                              ? "text-emerald-400"
                              : event.responseStatus !==
                                  null
                                ? "text-red-400"
                                : "text-zinc-600"
                          }`}
                        >
                          {event.responseStatus ??
                            "—"}
                        </span>

                      </div>

                      {/* ATTEMPTS */}

                      <div className="lg:col-span-1 lg:text-center">

                        <p className="lg:hidden text-[11px] uppercase tracking-wide text-zinc-600 mb-1">
                          Attempts
                        </p>

                        <span className="text-sm text-zinc-300">
                          {event.attemptCount}
                        </span>

                      </div>

                      {/* LATENCY */}

                      <div className="lg:col-span-1">

                        <p className="lg:hidden text-[11px] uppercase tracking-wide text-zinc-600 mb-1">
                          Latency
                        </p>

                        <span className="text-sm text-zinc-400">

                          {event.latencyMs !==
                          null
                            ? `${event.latencyMs}ms`
                            : "—"}

                        </span>

                      </div>

                      {/* CREATED */}

                      <div className="lg:col-span-2">

                        <p className="lg:hidden text-[11px] uppercase tracking-wide text-zinc-600 mb-1">
                          Created
                        </p>

                        <span className="text-xs text-zinc-500">

                          {new Date(
                            event.createdAt
                          ).toLocaleString()}

                        </span>

                      </div>

                    </div>
                  )
                )}

              </div>
            )}

          </section>

          {/* ==================================================
              FOOTER
          ================================================== */}

          <footer className="text-center py-10">

            <p className="text-sm text-zinc-700">
              PulseEngine • Reliable Asynchronous Webhook Delivery
            </p>

          </footer>

        </main>

      ) : activeView ===
        "projects" ? (

        /* ====================================================
            PROJECTS VIEW
        ==================================================== */

        <main className="max-w-[1600px] mx-auto px-5 md:px-8 py-8">

          <ProjectManager
            onProjectsChanged={() => {
              void loadDashboard(
                true
              );
            }}
          />

        </main>

      ) : (

        /* ====================================================
            ENDPOINTS VIEW
        ==================================================== */

        <main className="max-w-[1600px] mx-auto px-5 md:px-8 py-8">

          <EndpointManager
            onEndpointsChanged={() => {
              void loadDashboard(
                true
              );
            }}
          />

        </main>

      )}

      {/* ====================================================
          WEBHOOK EVENT DETAILS / PAYLOAD INSPECTOR
      ==================================================== */}

      {activeView ===
        "dashboard" && (
        <WebhookEventDetailsModal
          eventId={
            selectedEventId
          }
          onClose={() =>
            setSelectedEventId(
              null
            )
          }
          onRedelivered={() =>
            void loadDashboard(
              true
            )
          }
        />
      )}

    </div>
  );
}

// ==========================================================
// CONSOLE NAV BUTTON
// ==========================================================

interface ConsoleNavButtonProps {
  label:
    string;

  active:
    boolean;

  onClick:
    () => void;
}

function ConsoleNavButton({
  label,
  active,
  onClick,
}: ConsoleNavButtonProps) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
        active
          ? "bg-zinc-800 text-white shadow-sm"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
      }`}
    >
      {label}
    </button>
  );
}

// ==========================================================
// METRIC CARD
// ==========================================================

interface MetricCardProps {
  title:
    string;

  value:
    string | number;

  subtitle:
    string;

  icon:
    ReactNode;

  iconClass:
    string;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  iconClass,
}: MetricCardProps) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition">

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">

          <p className="text-sm text-zinc-500">
            {title}
          </p>

          <p className="text-3xl font-bold tracking-tight mt-2 truncate">
            {value}
          </p>

        </div>

        <div
          className={`shrink-0 w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center ${iconClass}`}
        >
          {icon}
        </div>

      </div>

      <p className="text-xs text-zinc-600 mt-4 truncate">
        {subtitle}
      </p>

    </div>
  );
}

// ==========================================================
// HEALTH ROW
// ==========================================================

interface HealthRowProps {
  label:
    string;

  value:
    number;

  valueClass:
    string;
}

function HealthRow({
  label,
  value,
  valueClass,
}: HealthRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">

      <span className="text-sm text-zinc-400">
        {label}
      </span>

      <span
        className={`font-semibold ${valueClass}`}
      >
        {value}
      </span>

    </div>
  );
}

// ==========================================================
// SYSTEM ROW
// ==========================================================

interface SystemRowProps {
  icon:
    ReactNode;

  label:
    string;

  value:
    string;

  valueClass:
    string;
}

function SystemRow({
  icon,
  label,
  value,
  valueClass,
}: SystemRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">

      <div className="flex items-center gap-3 min-w-0">

        <div className="text-zinc-600 shrink-0">
          {icon}
        </div>

        <span className="text-sm text-zinc-400 truncate">
          {label}
        </span>

      </div>

      <span
        className={`text-sm font-medium shrink-0 ${valueClass}`}
      >
        {value}
      </span>

    </div>
  );
}

// ==========================================================
// PERFORMANCE BOX
// ==========================================================

interface PerformanceBoxProps {
  label:
    string;

  value:
    string | number;

  valueClass?:
    string;
}

function PerformanceBox({
  label,
  value,
  valueClass =
    "text-white",
}: PerformanceBoxProps) {
  return (
    <div className="bg-black border border-zinc-800 rounded-xl p-4">

      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p
        className={`text-2xl font-bold mt-2 ${valueClass}`}
      >
        {value}
      </p>

    </div>
  );
}

// ==========================================================
// STATUS BADGE
// ==========================================================

function StatusBadge({
  status,
}: {
  status:
    WebhookEventStatus;
}) {
  const classes:
    Record<
      WebhookEventStatus,
      string
    > = {
      queued:
        "bg-blue-500/10 text-blue-400 border-blue-500/20",

      processing:
        "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",

      retrying:
        "bg-amber-500/10 text-amber-400 border-amber-500/20",

      success:
        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",

      failed:
        "bg-red-500/10 text-red-400 border-red-500/20",
    };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-semibold uppercase tracking-wide ${classes[status]}`}
    >
      {status}
    </span>
  );
}