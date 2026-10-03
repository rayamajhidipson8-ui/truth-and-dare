/**
 * Real-Time 2-Player Truth or Dare WebSocket & HTTP Server
 * Zero external database required - ultra-fast low-latency state synchronization.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 3000;

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// HTTP Static Server
const server = http.createServer((req, res) => {
  // Normalize URL
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  if (pathname === '/' || pathname === '/index.html') {
    pathname = '/index.html';
  } else if (pathname === '/experience') {
    pathname = '/the_truth_or_dare_experience.html';
  }

  const filePath = path.join(__dirname, pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA/rooms
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server });

/**
 * Room Structure:
 * {
 *   code: 'ABCD',
 *   players: [ { id: 'uuid', name: 'Dipson', role: 'p1', ws: WebSocket }, ... ],
 *   gameState: {
 *     round: 1,
 *     phase: 'lobby' | 'arena' | 'choice' | 'prompt' | 'execution',
 *     activePlayer: null,
 *     activePlayerRole: null, // 'p1' | 'p2'
 *     category: null,
 *     promptMode: 'spin',
 *     intensity: 1,
 *     currentTask: '',
 *     timerRemaining: 60,
 *     wheelSpins: 0,
 *     lastSpinTargetDeg: 0
 *   }
 * }
 */
const rooms = new Map();

function generateRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous I, O
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function broadcastToRoom(roomCode, message, excludeWs = null) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const payload = JSON.stringify(message);
  room.players.forEach(p => {
    if (p.ws !== excludeWs && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  });
}

function cleanPlayerFromRoom(ws) {
  for (const [code, room] of rooms.entries()) {
    const pIndex = room.players.findIndex(p => p.ws === ws);
    if (pIndex !== -1) {
      const removedPlayer = room.players[pIndex];
      room.players.splice(pIndex, 1);

      console.log(`[WS] Player ${removedPlayer.name} (${removedPlayer.role}) left room ${code}`);

      if (room.players.length === 0) {
        // Clean empty room after 5 minutes
        setTimeout(() => {
          if (rooms.has(code) && rooms.get(code).players.length === 0) {
            rooms.delete(code);
            console.log(`[WS] Room ${code} expired and cleared.`);
          }
        }, 300000);
      } else {
        broadcastToRoom(code, {
          type: 'PLAYER_DISCONNECTED',
          playerRole: removedPlayer.role,
          playerName: removedPlayer.name,
          playerCount: room.players.length
        });
      }
      break;
    }
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleMessage(ws, msg);
    } catch (err) {
      console.error('[WS Error]', err);
    }
  });

  ws.on('close', () => {
    cleanPlayerFromRoom(ws);
  });
});

function handleMessage(ws, msg) {
  const { type, roomCode, payload } = msg;

  switch (type) {
    case 'CREATE_ROOM': {
      const code = generateRoomCode();
      const playerName = (payload && payload.playerName) || 'Player 1';
      const initialRoom = {
        code,
        players: [{
          id: 'p1_' + Math.random().toString(36).substring(2, 9),
          name: playerName,
          role: 'p1',
          ws
        }],
        gameState: {
          round: 1,
          phase: 'lobby',
          activePlayer: null,
          activePlayerRole: null,
          category: null,
          promptMode: 'spin',
          intensity: 1,
          currentTask: '',
          timerRemaining: 60,
          wheelSpins: 0,
          lastSpinTargetDeg: 0
        }
      };
      rooms.set(code, initialRoom);

      console.log(`[WS] Room created: ${code} by ${playerName} (p1)`);

      ws.send(JSON.stringify({
        type: 'ROOM_CREATED',
        roomCode: code,
        role: 'p1',
        playerName,
        gameState: initialRoom.gameState
      }));
      break;
    }

    case 'JOIN_ROOM': {
      const targetCode = (roomCode || '').toUpperCase().trim();
      const room = rooms.get(targetCode);

      if (!room) {
        ws.send(JSON.stringify({
          type: 'JOIN_ERROR',
          error: `Room "${targetCode}" not found. Verify the 4-letter code.`
        }));
        return;
      }

      if (room.players.length >= 2) {
        ws.send(JSON.stringify({
          type: 'JOIN_ERROR',
          error: `Room "${targetCode}" is already full (2/2 players).`
        }));
        return;
      }

      const playerName = (payload && payload.playerName) || 'Player 2';
      const playerObj = {
        id: 'p2_' + Math.random().toString(36).substring(2, 9),
        name: playerName,
        role: 'p2',
        ws
      };
      room.players.push(playerObj);
      room.gameState.phase = 'arena';

      console.log(`[WS] ${playerName} (p2) joined room ${targetCode}. Transitioning both screens to arena!`);

      // Inform Player 2 that they joined successfully
      ws.send(JSON.stringify({
        type: 'ROOM_JOINED',
        roomCode: targetCode,
        role: 'p2',
        playerName,
        opponentName: room.players[0].name,
        gameState: room.gameState
      }));

      // Broadcast to both players that room is now ready and both should transition to active game board
      broadcastToRoom(targetCode, {
        type: 'GAME_STARTED',
        roomCode: targetCode,
        players: room.players.map(p => ({ role: p.role, name: p.name })),
        gameState: room.gameState
      });
      break;
    }

    case 'SPIN_WHEEL': {
      const room = rooms.get(roomCode);
      if (!room) return;

      const { targetDeg, chosenPlayer, chosenRole, spinCount } = payload;
      room.gameState.wheelSpins = spinCount;
      room.gameState.lastSpinTargetDeg = targetDeg;
      room.gameState.activePlayer = chosenPlayer;
      room.gameState.activePlayerRole = chosenRole;
      room.gameState.phase = 'roulette_spinning';

      broadcastToRoom(roomCode, {
        type: 'WHEEL_SPUN',
        payload: {
          targetDeg,
          chosenPlayer,
          chosenRole,
          spinCount,
          timestamp: Date.now()
        }
      });
      break;
    }

    case 'SELECT_CATEGORY': {
      const room = rooms.get(roomCode);
      if (!room) return;

      room.gameState.category = payload.category;
      room.gameState.phase = 'directive_selection';

      broadcastToRoom(roomCode, {
        type: 'CATEGORY_SELECTED',
        payload: {
          category: payload.category,
          byRole: payload.byRole
        }
      });
      break;
    }

    case 'SWITCH_PROMPT_MODE': {
      const room = rooms.get(roomCode);
      if (!room) return;

      room.gameState.promptMode = payload.mode;
      broadcastToRoom(roomCode, {
        type: 'PROMPT_MODE_SWITCHED',
        payload: { mode: payload.mode }
      });
      break;
    }

    case 'SET_INTENSITY': {
      const room = rooms.get(roomCode);
      if (!room) return;

      room.gameState.intensity = payload.tier;
      broadcastToRoom(roomCode, {
        type: 'INTENSITY_SET',
        payload: { tier: payload.tier }
      });
      break;
    }

    case 'ROLLING_PROMPTS': {
      // Slot machine animation tick
      broadcastToRoom(roomCode, {
        type: 'PROMPT_SLOT_ROLLING',
        payload: { text: payload.text }
      }, ws);
      break;
    }

    case 'DIRECTIVE_REVEALED': {
      const room = rooms.get(roomCode);
      if (!room) return;

      room.gameState.currentTask = payload.task;
      room.gameState.phase = 'execution';
      room.gameState.timerRemaining = 60;

      broadcastToRoom(roomCode, {
        type: 'DIRECTIVE_REVEALED',
        payload: {
          task: payload.task,
          isCustom: payload.isCustom || false,
          senderName: payload.senderName || 'Opponent'
        }
      });
      break;
    }

    case 'CUSTOM_TYPING': {
      // Non-selected player is typing a custom challenge
      broadcastToRoom(roomCode, {
        type: 'CUSTOM_TYPING_INDICATOR',
        payload: {
          isTyping: payload.isTyping,
          senderRole: payload.senderRole
        }
      }, ws);
      break;
    }

    case 'COMPLETE_CHALLENGE': {
      const room = rooms.get(roomCode);
      if (!room) return;

      broadcastToRoom(roomCode, {
        type: 'CHALLENGE_COMPLETED',
        payload: {
          completedBy: payload.completedBy
        }
      });
      break;
    }

    case 'TRIGGER_PENALTY': {
      const room = rooms.get(roomCode);
      if (!room) return;

      room.gameState.currentTask = payload.penaltyTask;
      broadcastToRoom(roomCode, {
        type: 'PENALTY_ENFORCED',
        payload: {
          reason: payload.reason,
          penaltyTask: payload.penaltyTask
        }
      });
      break;
    }

    case 'NEXT_ROUND': {
      const room = rooms.get(roomCode);
      if (!room) return;

      room.gameState.round += 1;
      room.gameState.category = null;
      room.gameState.currentTask = '';
      room.gameState.activePlayer = null;
      room.gameState.activePlayerRole = null;
      room.gameState.phase = 'arena';

      broadcastToRoom(roomCode, {
        type: 'NEXT_ROUND_STARTED',
        payload: {
          round: room.gameState.round
        }
      });
      break;
    }

    case 'RESET_GAME': {
      const room = rooms.get(roomCode);
      if (!room) return;

      room.gameState.round = 1;
      room.gameState.category = null;
      room.gameState.currentTask = '';
      room.gameState.activePlayer = null;
      room.gameState.activePlayerRole = null;
      room.gameState.phase = 'arena';

      broadcastToRoom(roomCode, {
        type: 'GAME_RESET',
        payload: { round: 1 }
      });
      break;
    }

    case 'EMOJI_REACTION': {
      broadcastToRoom(roomCode, {
        type: 'EMOJI_REACTION',
        payload: {
          emoji: payload.emoji,
          senderRole: payload.senderRole
        }
      });
      break;
    }

    case 'WATER_RITUAL_DONE': {
      const room = rooms.get(roomCode);
      if (!room) return;

      broadcastToRoom(roomCode, {
        type: 'WATER_RITUAL_COMPLETED',
        payload: {
          playerRole: payload.playerRole
        }
      });
      break;
    }

    case 'QUERY_ROOM': {
      const targetCode = (roomCode || '').toUpperCase().trim();
      const room = rooms.get(targetCode);
      if (!room) {
        ws.send(JSON.stringify({
          type: 'ROOM_NOT_FOUND',
          roomCode: targetCode
        }));
      } else {
        const hostPlayer = room.players.find(p => p.role === 'p1');
        ws.send(JSON.stringify({
          type: 'ROOM_INFO',
          roomCode: targetCode,
          hostName: hostPlayer ? hostPlayer.name : 'Host',
          isFull: room.players.length >= 2
        }));
      }
      break;
    }

    case 'UPDATE_PLAYER_NAME': {
      const room = rooms.get(roomCode);
      if (!room) return;

      const player = room.players.find(p => p.role === payload.role);
      if (player) {
        const oldName = player.name;
        player.name = payload.newName;
        console.log(`[WS] ${oldName} (${payload.role}) renamed to: ${payload.newName}`);
        broadcastToRoom(roomCode, {
          type: 'PLAYER_NAME_UPDATED',
          payload: {
            role: payload.role,
            newName: payload.newName,
            oldName: oldName
          }
        });
      }
      break;
    }

    default:
      console.log(`[WS] Unhandled message type: ${type}`);
  }
}

// Keep-alive heartbeat interval (every 30s)
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Truth or Dare Real-Time Server running!`);
  console.log(`🌐 Local Web App: http://localhost:${PORT}`);
  console.log(`⚡ WebSocket Hub: ws://localhost:${PORT}`);
  console.log(`=======================================================`);
});
