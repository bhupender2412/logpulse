import { useEffect, useState } from "react";
import { io } from "socket.io-client";

import { getLogs, type Log } from "../api/logsApi";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

export function useLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadLogs() {
      try {
        setLoading(true);

        const data = await getLogs();

        if (mounted) {
          setLogs(data);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to load logs:", err);

        if (mounted) {
          setError("Failed to load logs");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadLogs();

    const socket = io(API_URL);

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    socket.on("log:new", (newLog: Log) => {
      console.log("New log received:", newLog);

      setLogs((previousLogs) => {
        const alreadyExists = previousLogs.some(
          (log) => log._id === newLog._id
        );

        if (alreadyExists) {
          return previousLogs;
        }

        return [newLog, ...previousLogs];
      });
    });

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, []);

  return {
    logs,
    loading,
    error,
    connected,
  };
}