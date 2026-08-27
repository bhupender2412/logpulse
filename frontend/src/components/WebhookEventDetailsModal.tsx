import {
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  Clock3,
  Copy,
  RefreshCw,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";

import {
  getEvent,
  getRedeliveries,
  redeliverEvent,
  type RedeliveryHistoryResponse,
  type WebhookEvent,
} from "../api/eventsApi";

// ==========================================================
// PROPS
// ==========================================================

interface Props {
  eventId:
    string | null;

  onClose:
    () => void;

  onRedelivered?:
    () => void;
}

// ==========================================================
// FORMAT VALUE
// ==========================================================

function formatValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "null";
  }

  if (
    typeof value ===
    "string"
  ) {
    // Try formatting JSON response strings.
    try {
      return JSON.stringify(
        JSON.parse(
          value
        ),
        null,
        2
      );
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(
      value,
      null,
      2
    );
  } catch {
    return String(
      value
    );
  }
}

// ==========================================================
// COMPONENT
// ==========================================================

export default function WebhookEventDetailsModal({
  eventId,
  onClose,
  onRedelivered,
}: Props) {
  const [
    event,
    setEvent,
  ] =
    useState<WebhookEvent | null>(
      null
    );

  const [
    redeliveryHistory,
    setRedeliveryHistory,
  ] =
    useState<RedeliveryHistoryResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );

  const [
    retrying,
    setRetrying,
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

  const [
    copied,
    setCopied,
  ] =
    useState(
      ""
    );

  // ========================================================
  // LOAD EVENT
  // ========================================================

  useEffect(() => {
    if (!eventId) {
      setEvent(
        null
      );

      setRedeliveryHistory(
        null
      );

      return;
    }

    const load =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          const eventResponse =
            await getEvent(
              eventId
            );

          setEvent(
            eventResponse.event
          );

          // Redelivery history is useful mainly for failed
          // source events, but safe to request for any event.
          try {
            const history =
              await getRedeliveries(
                eventId
              );

            setRedeliveryHistory(
              history
            );
          } catch {
            setRedeliveryHistory(
              null
            );
          }
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load webhook event"
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    void load();
  }, [
    eventId,
  ]);

  // ========================================================
  // ESCAPE TO CLOSE
  // ========================================================

  useEffect(() => {
    if (!eventId) {
      return;
    }

    const handleKeyDown =
      (
        keyboardEvent:
          KeyboardEvent
      ) => {
        if (
          keyboardEvent.key ===
          "Escape"
        ) {
          onClose();
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    eventId,
    onClose,
  ]);

  // ========================================================
  // COPY
  // ========================================================

  const copyValue =
    async (
      label:
        string,
      value:
        string
    ) => {
      try {
        await navigator.clipboard.writeText(
          value
        );

        setCopied(
          label
        );

        window.setTimeout(
          () => {
            setCopied(
              ""
            );
          },
          1500
        );
      } catch {
        setCopied(
          ""
        );
      }
    };

  // ========================================================
  // MANUAL REDELIVERY
  // ========================================================

  const handleRedeliver =
    async () => {
      if (
        !event ||
        event.status !==
          "failed"
      ) {
        return;
      }

      try {
        setRetrying(
          true
        );

        setError(
          ""
        );

        await redeliverEvent(
          event.eventId
        );

        // Refresh redelivery history.
        const history =
          await getRedeliveries(
            event.eventId
          );

        setRedeliveryHistory(
          history
        );

        onRedelivered?.();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to redeliver webhook"
        );
      } finally {
        setRetrying(
          false
        );
      }
    };

  // ========================================================
  // CLOSED
  // ========================================================

  if (!eventId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6">

      {/* BACKDROP */}

      <button
        type="button"
        aria-label="Close event details"
        onClick={
          onClose
        }
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* MODAL */}

      <div className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="flex items-center justify-between gap-4 px-5 md:px-6 py-4 border-b border-zinc-800">

          <div className="min-w-0">

            <p className="text-xs text-emerald-400 font-semibold tracking-widest uppercase">
              Payload Inspector
            </p>

            <h2 className="text-lg font-semibold mt-1">
              Webhook Event Details
            </h2>

          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="w-9 h-9 shrink-0 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex items-center justify-center"
          >
            <X
              size={
                18
              }
            />
          </button>

        </div>

        {/* ==================================================
            BODY
        ================================================== */}

        <div className="overflow-y-auto max-h-[calc(92vh-70px)]">

          {loading ? (
            <div className="h-[420px] flex flex-col items-center justify-center text-zinc-500">

              <RefreshCw
                size={
                  26
                }
                className="animate-spin mb-3"
              />

              Loading webhook event...

            </div>
          ) : error &&
            !event ? (
            <div className="p-8 text-red-400">
              {error}
            </div>
          ) : event ? (
            <div className="p-5 md:p-6">

              {/* ERROR */}

              {error && (
                <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              {/* ============================================
                  EVENT SUMMARY
              ============================================ */}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                <InfoCard
                  label="Status"
                  value={
                    event.status
                  }
                  valueClass={
                    event.status ===
                    "success"
                      ? "text-emerald-400"
                      : event.status ===
                          "failed"
                        ? "text-red-400"
                        : event.status ===
                            "retrying"
                          ? "text-amber-400"
                          : "text-indigo-400"
                  }
                />

                <InfoCard
                  label="HTTP Status"
                  value={
                    event.responseStatus ??
                    "—"
                  }
                />

                <InfoCard
                  label="Attempts"
                  value={
                    event.attemptCount
                  }
                />

                <InfoCard
                  label="Latency"
                  value={
                    event.latencyMs !==
                    null
                      ? `${event.latencyMs} ms`
                      : "—"
                  }
                />

              </div>

              {/* ============================================
                  EVENT META
              ============================================ */}

              <section className="bg-black border border-zinc-800 rounded-xl mb-6">

                <SectionHeader
                  title="Event Information"
                />

                <div className="divide-y divide-zinc-800">

                  <MetaRow
                    label="Event ID"
                    value={
                      event.eventId
                    }
                    copy={() =>
                      void copyValue(
                        "eventId",
                        event.eventId
                      )
                    }
                    copied={
                      copied ===
                      "eventId"
                    }
                  />

                  <MetaRow
                    label="Project"
                    value={
                      event.projectId
                    }
                  />

                  <MetaRow
                    label="Endpoint"
                    value={
                      event.endpointId
                    }
                  />

                  {event.redeliveryOf && (
                    <MetaRow
                      label="Redelivery Of"
                      value={
                        event.redeliveryOf
                      }
                    />
                  )}

                  <MetaRow
                    label="Created"
                    value={
                      new Date(
                        event.createdAt
                      ).toLocaleString()
                    }
                  />

                  <MetaRow
                    label="Completed"
                    value={
                      event.completedAt
                        ? new Date(
                            event.completedAt
                          ).toLocaleString()
                        : "—"
                    }
                  />

                </div>

              </section>

              {/* ============================================
                  PAYLOAD + RESPONSE
              ============================================ */}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

                {/* PAYLOAD */}

                <CodePanel
                  title="Request Payload"
                  value={
                    formatValue(
                      event.payload
                    )
                  }
                  onCopy={() =>
                    void copyValue(
                      "payload",
                      formatValue(
                        event.payload
                      )
                    )
                  }
                  copied={
                    copied ===
                    "payload"
                  }
                />

                {/* RESPONSE */}

                <CodePanel
                  title="Response Body"
                  value={
                    formatValue(
                      event.responseBody
                    )
                  }
                  onCopy={() =>
                    void copyValue(
                      "response",
                      formatValue(
                        event.responseBody
                      )
                    )
                  }
                  copied={
                    copied ===
                    "response"
                  }
                />

              </div>

              {/* ============================================
                  ERROR MESSAGE
              ============================================ */}

              {event.error && (
                <section className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 mb-6">

                  <div className="flex items-start gap-3">

                    <XCircle
                      size={
                        19
                      }
                      className="text-red-400 shrink-0 mt-0.5"
                    />

                    <div>

                      <p className="font-medium text-red-400">
                        Delivery Error
                      </p>

                      <p className="text-sm text-red-300/70 mt-1">
                        {event.error}
                      </p>

                    </div>

                  </div>

                </section>
              )}

              {/* ============================================
                  ATTEMPT HISTORY
              ============================================ */}

              <section className="bg-black border border-zinc-800 rounded-xl mb-6">

                <SectionHeader
                  title="Delivery Attempts"
                  subtitle={`${event.attempts?.length ?? 0} recorded attempts`}
                />

                {!Array.isArray(
                  event.attempts
                ) ||
                event.attempts.length ===
                  0 ? (
                  <div className="p-6 text-sm text-zinc-600">
                    No delivery attempts recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800">

                    {event.attempts.map(
                      (
                        attempt
                      ) => (
                        <div
                          key={
                            `${attempt.attempt}-${attempt.timestamp}`
                          }
                          className="p-5"
                        >

                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                            <div className="flex items-center gap-3">

                              {attempt.status ===
                              "success" ? (
                                <CheckCircle2
                                  size={
                                    19
                                  }
                                  className="text-emerald-400"
                                />
                              ) : (
                                <XCircle
                                  size={
                                    19
                                  }
                                  className="text-red-400"
                                />
                              )}

                              <div>

                                <p className="font-medium">
                                  Attempt{" "}
                                  {attempt.attempt}
                                </p>

                                <p className="text-xs text-zinc-600 mt-1">
                                  {new Date(
                                    attempt.timestamp
                                  ).toLocaleString()}
                                </p>

                              </div>

                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm">

                              <span className="text-zinc-500">
                                HTTP{" "}
                                <span className="text-zinc-300">
                                  {attempt.statusCode ??
                                    "—"}
                                </span>
                              </span>

                              <span className="text-zinc-500">
                                Latency{" "}
                                <span className="text-zinc-300">
                                  {attempt.latencyMs !==
                                  null
                                    ? `${attempt.latencyMs}ms`
                                    : "—"}
                                </span>
                              </span>

                            </div>

                          </div>

                          {attempt.error && (
                            <p className="text-sm text-red-400 mt-3 pl-8">
                              {attempt.error}
                            </p>
                          )}

                        </div>
                      )
                    )}

                  </div>
                )}

              </section>

              {/* ============================================
                  REDELIVERY HISTORY
              ============================================ */}

              {redeliveryHistory &&
                redeliveryHistory.count >
                  0 && (
                  <section className="bg-black border border-zinc-800 rounded-xl mb-6">

                    <SectionHeader
                      title="Manual Redeliveries"
                      subtitle={`${redeliveryHistory.count} redelivery events`}
                    />

                    <div className="divide-y divide-zinc-800">

                      {redeliveryHistory.redeliveries.map(
                        (
                          redelivery
                        ) => (
                          <div
                            key={
                              redelivery.eventId
                            }
                            className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                          >

                            <div>

                              <p className="font-mono text-xs text-zinc-300 break-all">
                                {redelivery.eventId}
                              </p>

                              <p className="text-xs text-zinc-600 mt-1">
                                {new Date(
                                  redelivery.createdAt
                                ).toLocaleString()}
                              </p>

                            </div>

                            <div className="flex items-center gap-4">

                              <span
                                className={`text-xs uppercase font-semibold ${
                                  redelivery.status ===
                                  "success"
                                    ? "text-emerald-400"
                                    : redelivery.status ===
                                        "failed"
                                      ? "text-red-400"
                                      : "text-amber-400"
                                }`}
                              >
                                {redelivery.status}
                              </span>

                              <span className="text-sm text-zinc-500">
                                {redelivery.latencyMs !==
                                null
                                  ? `${redelivery.latencyMs}ms`
                                  : "—"}
                              </span>

                            </div>

                          </div>
                        )
                      )}

                    </div>

                  </section>
                )}

              {/* ============================================
                  ACTION BAR
              ============================================ */}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">

                <div className="flex items-center gap-2 text-sm text-zinc-600">

                  <Clock3
                    size={
                      16
                    }
                  />

                  Event lifecycle stored permanently in MongoDB

                </div>

                {event.status ===
                  "failed" && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleRedeliver()
                    }
                    disabled={
                      retrying
                    }
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-400 font-medium transition"
                  >

                    <RotateCcw
                      size={
                        17
                      }
                      className={
                        retrying
                          ? "animate-spin"
                          : ""
                      }
                    />

                    {retrying
                      ? "Queueing..."
                      : "Retry Now"}

                  </button>
                )}

              </div>

            </div>
          ) : null}

        </div>

      </div>

    </div>
  );
}

// ==========================================================
// INFO CARD
// ==========================================================

function InfoCard({
  label,
  value,
  valueClass =
    "text-zinc-100",
}: {
  label:
    string;

  value:
    string | number;

  valueClass?:
    string;
}) {
  return (
    <div className="bg-black border border-zinc-800 rounded-xl p-4">

      <p className="text-xs text-zinc-600 uppercase tracking-wide">
        {label}
      </p>

      <p
        className={`text-xl font-semibold mt-2 ${valueClass}`}
      >
        {value}
      </p>

    </div>
  );
}

// ==========================================================
// SECTION HEADER
// ==========================================================

function SectionHeader({
  title,
  subtitle,
}: {
  title:
    string;

  subtitle?:
    string;
}) {
  return (
    <div className="px-5 py-4 border-b border-zinc-800">

      <p className="font-medium">
        {title}
      </p>

      {subtitle && (
        <p className="text-xs text-zinc-600 mt-1">
          {subtitle}
        </p>
      )}

    </div>
  );
}

// ==========================================================
// META ROW
// ==========================================================

function MetaRow({
  label,
  value,
  copy,
  copied,
}: {
  label:
    string;

  value:
    string;

  copy?:
    () => void;

  copied?:
    boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2 md:gap-4 px-5 py-3">

      <span className="text-sm text-zinc-600">
        {label}
      </span>

      <span className="text-sm text-zinc-300 font-mono break-all">
        {value}
      </span>

      {copy && (
        <button
          type="button"
          onClick={
            copy
          }
          className="text-xs text-zinc-500 hover:text-white flex items-center gap-1.5"
        >

          <Copy
            size={
              13
            }
          />

          {copied
            ? "Copied"
            : "Copy"}

        </button>
      )}

    </div>
  );
}

// ==========================================================
// CODE PANEL
// ==========================================================

function CodePanel({
  title,
  value,
  onCopy,
  copied,
}: {
  title:
    string;

  value:
    string;

  onCopy:
    () => void;

  copied:
    boolean;
}) {
  return (
    <section className="bg-black border border-zinc-800 rounded-xl overflow-hidden">

      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">

        <span className="text-sm font-medium">
          {title}
        </span>

        <button
          type="button"
          onClick={
            onCopy
          }
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white"
        >

          <Copy
            size={
              13
            }
          />

          {copied
            ? "Copied"
            : "Copy"}

        </button>

      </div>

      <pre className="p-4 text-xs leading-6 text-zinc-300 overflow-auto max-h-[350px] font-mono whitespace-pre-wrap break-words">
        {value}
      </pre>

    </section>
  );
}