import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface LogEvent {
  id: string;
  projectId: string;
  level: "info" | "warn" | "error" | "fatal";
  message: string;
  timestamp: string;
}

const socket: Socket = io("http://localhost:4000", {
  transports: ["websocket"],
});

export default function App() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("✅ Socket Connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket Disconnected");
      setConnected(false);
    });

    socket.on("log:new", (newLog: LogEvent) => {
      console.log("📥 New Log:", newLog);

      setLogs((prev) => [newLog, ...prev].slice(0, 100));
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("log:new");
    };
  }, []);

  const getBadgeClass = (level: string) => {
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

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">🚀 LogPulse Console</h1>
          <p className="text-gray-400 mt-2">
            Real-Time Log Monitoring Dashboard
          </p>
        </div>

        <div
          className={`px-4 py-2 rounded-lg font-semibold border ${
            connected
              ? "bg-green-500/20 text-green-400 border-green-500/30"
              : "bg-red-500/20 text-red-400 border-red-500/30"
          }`}
        >
          {connected ? "🟢 LIVE" : "🔴 OFFLINE"}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 flex gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 min-w-[200px]">
          <p className="text-gray-400 text-sm">Stored Logs</p>
          <h2 className="text-3xl font-bold">{logs.length}</h2>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-4 gap-4 bg-zinc-900 p-4 rounded-t-lg border border-zinc-800 font-semibold text-gray-300">
        <div>Timestamp</div>
        <div>Project</div>
        <div>Level</div>
        <div>Message</div>
      </div>

      {/* Logs */}
      <div className="border border-t-0 border-zinc-800 rounded-b-lg max-h-[650px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            Waiting for incoming logs...
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-4 gap-4 p-4 border-b border-zinc-800 hover:bg-zinc-900/50 transition"
            >
              <div className="text-sm text-gray-400">
                {new Date(log.timestamp).toLocaleTimeString()}
              </div>

              <div className="font-medium">{log.projectId}</div>

              <div>
                <span
                  className={`px-3 py-1 rounded-md border text-xs font-bold uppercase ${getBadgeClass(
                    log.level
                  )}`}
                >
                  {log.level}
                </span>
              </div>

              <div className="truncate">{log.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}