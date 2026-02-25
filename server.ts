import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Game state storage (in-memory for now)
  const games = new Map<string, any>();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);

      if (!games.has(roomId)) {
        games.set(roomId, {
          players: [],
          board: null, // Initialized on client or first move
          turn: 'red'
        });
      }

      const game = games.get(roomId);
      if (game.players.length < 2 && !game.players.includes(socket.id)) {
        game.players.push(socket.id);
      }

      const side = game.players[0] === socket.id ? 'red' : (game.players[1] === socket.id ? 'black' : 'spectator');
      socket.emit("init-game", { side, game });
      io.to(roomId).emit("player-joined", { count: game.players.length });
    });

    socket.on("move", ({ roomId, from, to, board, turn }) => {
      const game = games.get(roomId);
      if (game) {
        game.board = board;
        game.turn = turn;
        socket.to(roomId).emit("remote-move", { from, to, board, turn });
      }
    });

    socket.on("reset-game", (roomId) => {
      const game = games.get(roomId);
      if (game) {
        game.board = null;
        game.turn = 'red';
        io.to(roomId).emit("game-reset");
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      // Optional: Handle player leaving
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
