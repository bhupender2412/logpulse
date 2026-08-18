import type { Log } from "../api/logsApi";

interface Props {
  log: Log | null;
  onClose: () => void;
}

export default function LogDetailsModal({
  log,
  onClose,
}: Props) {
  if (!log) {
    return null;
  }

  const getLevelClass = () => {
    switch (log.level) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        {/* HEADER */}

        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Log Details
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Full log information
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gray-300 hover:text-white transition text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* CONTENT */}

        <div className="p-6 space-y-6">

          {/* TOP INFO */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="bg-black/40 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Project
              </p>

              <p className="text-white font-semibold mt-2 break-all">
                {log.projectId}
              </p>
            </div>

            <div className="bg-black/40 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Level
              </p>

              <span
                className={`inline-block mt-2 px-3 py-1 rounded-md border text-xs font-bold uppercase ${getLevelClass()}`}
              >
                {log.level}
              </span>
            </div>

            <div className="bg-black/40 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Timestamp
              </p>

              <p className="text-gray-200 mt-2 break-all">
                {new Date(
                  log.timestamp
                ).toLocaleString()}
              </p>
            </div>

            <div className="bg-black/40 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Log ID
              </p>

              <p className="text-gray-200 mt-2 break-all font-mono text-sm">
                {log._id}
              </p>
            </div>

          </div>

          {/* MESSAGE */}

          <div>
            <p className="text-sm font-semibold text-gray-300 mb-2">
              Message
            </p>

            <div className="bg-black border border-zinc-800 rounded-xl p-5">
              <p className="text-white whitespace-pre-wrap break-words">
                {log.message}
              </p>
            </div>
          </div>

          {/* METADATA */}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-300">
                Metadata
              </p>

              {!log.metadata ||
              Object.keys(
                log.metadata
              ).length === 0 ? (
                <span className="text-xs text-gray-600">
                  No metadata
                </span>
              ) : null}
            </div>

            <div className="bg-black border border-zinc-800 rounded-xl p-5 overflow-x-auto">
              {log.metadata &&
              Object.keys(
                log.metadata
              ).length > 0 ? (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                  {JSON.stringify(
                    log.metadata,
                    null,
                    2
                  )}
                </pre>
              ) : (
                <p className="text-gray-600">
                  No metadata available for this log.
                </p>
              )}
            </div>
          </div>

          {/* CREATED / UPDATED */}

          {(log.createdAt ||
            log.updatedAt) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {log.createdAt && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Created At
                  </p>

                  <p className="text-sm text-gray-400 mt-1">
                    {new Date(
                      log.createdAt
                    ).toLocaleString()}
                  </p>
                </div>
              )}

              {log.updatedAt && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Updated At
                  </p>

                  <p className="text-sm text-gray-400 mt-1">
                    {new Date(
                      log.updatedAt
                    ).toLocaleString()}
                  </p>
                </div>
              )}

            </div>
          )}

        </div>

        {/* FOOTER */}

        <div className="flex justify-end p-6 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}