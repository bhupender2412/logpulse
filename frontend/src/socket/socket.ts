import {
  io,
  type Socket,
} from "socket.io-client";

import {
  API_URL,
} from "../api/apiClient";

import {
  getToken,
} from "../api/tokenStorage";

// ==========================================================
// SOCKET
// ==========================================================

export const socket: Socket =
  io(
    API_URL,
    {
      autoConnect:
        false,

      transports: [
        "websocket",
      ],
    }
  );

// ==========================================================
// CONNECT
// ==========================================================

export function connectSocket(): void {
  const token =
    getToken();

  if (!token) {
    console.warn(
      "⚠️ Socket connection skipped: no JWT"
    );

    return;
  }

  socket.auth = {
    token,
  };

  if (
    !socket.connected
  ) {
    socket.connect();
  }
}

// ==========================================================
// DISCONNECT
// ==========================================================

export function disconnectSocket(): void {
  if (
    socket.connected
  ) {
    socket.disconnect();
  }
}