// Authoritative Server for Belt Panic!
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { GameRoom } from './gameRoom.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

// Enable CORS for Vercel and all external frontend origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
}));

// Check if dist exists, else serve client directly with Vite or static
const distPath = path.join(ROOT_DIR, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  app.use(express.static(path.join(ROOT_DIR, 'client')));
  app.use('/node_modules', express.static(path.join(ROOT_DIR, 'node_modules')));
}

// Render Health Check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: rooms.size,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'Belt Panic! Authoritative Multiplayer Server',
    status: 'online',
    version: '1.0.0',
    rooms: rooms.size,
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server });

// Room management
const rooms = new Map(); // roomId -> GameRoom
const clientRoomMap = new Map(); // ws -> { roomId, playerId }

function broadcastToRoom(roomId, message) {
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  for (const [ws, info] of clientRoomMap.entries()) {
    if (info.roomId === roomId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function removeClientFromRoom(ws) {
  if (clientRoomMap.has(ws)) {
    const { roomId, playerId } = clientRoomMap.get(ws);
    clientRoomMap.delete(ws);
    const room = rooms.get(roomId);
    if (room) {
      console.log(`[Room ${roomId}] Player left/disconnected: ${playerId}`);
      room.removePlayer(playerId);
      if (room.players.size === 0) {
        room.stopLoop();
        rooms.delete(roomId);
        console.log(`[Room ${roomId}] Closed empty room.`);
      }
    }
  }
}

function getOrCreateRoom(roomId) {
  const normId = (roomId || 'default').toUpperCase().trim();
  if (!rooms.has(normId)) {
    console.log(`[Room ${normId}] Created new game room.`);
    const room = new GameRoom(normId, broadcastToRoom);
    rooms.set(normId, room);
  }
  return rooms.get(normId);
}

wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerId = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      switch (msg.type) {
        case 'JOIN_ROOM': {
          // If this socket was already in a room, remove old player first!
          removeClientFromRoom(ws);

          const roomId = (msg.roomId || 'DEFAULT').toUpperCase().trim();
          currentRoom = getOrCreateRoom(roomId);
          playerId = `p_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;

          clientRoomMap.set(ws, { roomId, playerId });

          const newPlayer = currentRoom.addPlayer(playerId, msg.name, msg.skin);

          // Reply with welcome & full room snapshot
          ws.send(
            JSON.stringify({
              type: 'JOINED_SUCCESS',
              playerId,
              roomId,
              phase: currentRoom.phase,
              matchTimer: currentRoom.matchTimer,
              phaseTimer: currentRoom.phaseTimer,
              hunterId: currentRoom.hunterId,
              belt: currentRoom.belt,
              players: Array.from(currentRoom.players.values()).map((p) => currentRoom._serializePlayer(p)),
            })
          );
          console.log(`[Room ${roomId}] Player joined: ${msg.name} (${playerId})`);
          break;
        }

        case 'LEAVE_ROOM': {
          removeClientFromRoom(ws);
          currentRoom = null;
          playerId = null;
          ws.send(JSON.stringify({ type: 'LEFT_ROOM_SUCCESS' }));
          break;
        }

        case 'PLAYER_INPUT': {
          if (currentRoom && playerId) {
            currentRoom.setPlayerInput(playerId, msg.input);
          }
          break;
        }

        case 'START_MATCH': {
          if (currentRoom) {
            console.log(`[Room ${currentRoom.id}] Starting match!`);
            currentRoom.startMatch();
          }
          break;
        }

        case 'ADD_BOTS': {
          if (currentRoom) {
            const count = Math.min(6, Math.max(1, msg.count || 3));
            currentRoom.addBots(count);
          }
          break;
        }

        case 'CLEAR_BOTS': {
          if (currentRoom) {
            currentRoom.clearBots();
          }
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: msg.timestamp }));
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling ws message:', err);
    }
  });

  ws.on('close', () => {
    removeClientFromRoom(ws);
    currentRoom = null;
    playerId = null;
  });

  ws.on('error', (err) => {
    console.error('WebSocket connection error:', err);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 BELT PANIC! authoritative server running on port ${PORT}`);
});

