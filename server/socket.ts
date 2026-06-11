import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server | null = null;

export function initSocket(server: HttpServer) {
  const allowedOrigins = process.env.LINK_COR
    ? process.env.LINK_COR.split(",").map(o => o.trim())
    : ["http://localhost:3000", "http://localhost:5173"];

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Client joins room associated with their userId
    socket.on("join", (userId: string) => {
      if (userId) {
        socket.join(userId);
        console.log(`[Socket] User ${userId} joined room ${userId}`);
      }
    });

    socket.on("leave", (userId: string) => {
      if (userId) {
        socket.leave(userId);
        console.log(`[Socket] User ${userId} left room ${userId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io is not initialized.");
  }
  return io;
}

export function emitToUser(userId: string, event: string, data: unknown) {
  if (io) {
    io.to(userId.toString()).emit(event, data);
  }
}
