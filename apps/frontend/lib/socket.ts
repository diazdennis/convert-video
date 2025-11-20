import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  socket = io(`${API_URL}/videos`, {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
