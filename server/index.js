const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// ─── CONFIG ───
const JWT_SECRET = process.env.JWT_SECRET || 'ludo-secret-key-change-in-production';
const PORT = process.env.PORT || 3001;

// ─── IN-MEMORY STORE ───
const users = new Map();       // username -> { username, passwordHash }
const rooms = new Map();       // roomCode -> Room
const playerSockets = new Map(); // socketId -> { username, roomCode }

// ─── GAME CONSTANTS ───
const COLORS = ['red', 'green', 'yellow', 'blue'];
const PATH = buildPath();
const START_POS = { red: 0, green: 13, yellow: 26, blue: 39 };
const HOME_ENTRY = { red: 51, green: 11, yellow: 25, blue: 37 };
const SAFE_POS = [0, 11, 25, 37];

function buildPath() {
  return [
    [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[6,6],
    [5,6],[4,6],[3,6],[2,6],[1,6],
    [1,7],[1,8],
    [2,8],[3,8],[4,8],[5,8],[6,8],
    [6,9],[6,10],[6,11],[6,12],[6,13],
    [7,13],[8,13],
    [8,12],[8,11],[8,10],[8,9],[8,8],
    [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
    [14,7],[14,6],
    [13,6],[12,6],[11,6],[10,6],[9,6],[8,6],
    [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0]
  ];
}

const HOME_STRETCH = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  blue:   [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
};

const HOME_CELLS = {
  red:    [[1,1],[1,4],[4,1],[4,4]],
  green:  [[1,10],[1,13],[4,10],[4,13]],
  yellow: [[10,10],[10,13],[13,10],[13,13]],
  blue:   [[10,1],[10,4],[13,1],[13,4]]
};

// ─── AUTH ROUTES ───
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (users.has(username)) return res.status(409).json({ error: 'Username already taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  users.set(username, { username, passwordHash });
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

app.post('/api/verify', (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, username: decoded.username });
  } catch {
    res.json({ valid: false });
  }
});

// ─── ROOM MANAGEMENT ───
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function createRoom(hostUsername) {
  const code = generateRoomCode();
  const room = {
    code,
    host: hostUsername,
    players: [{ username: hostUsername, color: 'red', ready: false }],
    game: null,
    maxPlayers: 4,
    status: 'waiting', // waiting, playing, finished
    chat: []
  };
  rooms.set(code, room);
  return room;
}

function getPlayerRoom(username) {
  for (const [code, room] of rooms) {
    if (room.players.some(p => p.username === username)) return room;
  }
  return null;
}

function assignColor(room) {
  const taken = new Set(room.players.map(p => p.color));
  for (const c of COLORS) {
    if (!taken.has(c)) return c;
  }
  return null;
}

function initGame(room) {
  const game = {
    turn: 0,
    phase: 'roll',
    dice: 0,
    players: room.players.map(p => ({
      username: p.username,
      color: p.color,
      tokens: [
        { pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 }
      ],
      finished: false
    }))
  };
  return game;
}

// ─── GAME LOGIC ───
function canMoveToken(game, color, tokenIdx, diceVal) {
  const player = game.players.find(p => p.color === color);
  if (!player) return false;
  const t = player.tokens[tokenIdx];
  if (t.pos === 58) return false;

  if (t.pos === -1) {
    if (diceVal !== 6) return false;
    const startPos = START_POS[color];
    return !player.tokens.some((ot, i) => i !== tokenIdx && ot.pos === startPos);
  }

  if (t.pos >= 52) {
    return t.pos + diceVal <= 58;
  }

  const newPos = t.pos + diceVal;
  const entry = HOME_ENTRY[color];

  // Check if passing through entry
  for (let i = t.pos + 1; i <= newPos; i++) {
    if (i === entry) {
      const stepsBeforeEntry = entry - t.pos;
      const homeStep = diceVal - stepsBeforeEntry;
      return homeStep <= 5;
    }
  }

  return newPos < 52;
}

function canAnyMove(game, color, diceVal) {
  for (let i = 0; i < 4; i++) {
    if (canMoveToken(game, color, i, diceVal)) return true;
  }
  return false;
}

function doMove(game, color, tokenIdx, diceVal) {
  const player = game.players.find(p => p.color === color);
  const t = player.tokens[tokenIdx];
  const result = { captured: false, finished: false, moved: true };

  if (t.pos === -1) {
    t.pos = START_POS[color];
    // Check capture at start
    if (!SAFE_POS.includes(t.pos)) {
      for (const other of game.players) {
        if (other.color === color) continue;
        for (const ot of other.tokens) {
          if (ot.pos === t.pos && ot.pos !== -1) {
            ot.pos = -1;
            result.captured = true;
          }
        }
      }
    }
  } else if (t.pos >= 52) {
    t.pos += diceVal;
  } else {
    const newPos = t.pos + diceVal;
    const entry = HOME_ENTRY[color];

    let enteringHome = false;
    for (let i = t.pos + 1; i <= newPos; i++) {
      if (i === entry) { enteringHome = true; break; }
    }

    if (enteringHome) {
      const stepsBeforeEntry = entry - t.pos;
      const homeStep = diceVal - stepsBeforeEntry;
      t.pos = 52 + homeStep - 1;
    } else {
      t.pos = newPos;
      // Check capture
      if (t.pos < 52 && !SAFE_POS.includes(t.pos)) {
        for (const other of game.players) {
          if (other.color === color) continue;
          for (const ot of other.tokens) {
            if (ot.pos === t.pos && ot.pos !== -1) {
              ot.pos = -1;
              result.captured = true;
            }
          }
        }
      }
    }
  }

  if (t.pos === 58) {
    result.finished = true;
    if (player.tokens.every(tok => tok.pos === 58)) {
      player.finished = true;
    }
  }

  return result;
}

function nextTurn(game) {
  const activePlayers = game.players.filter(p => !p.finished);
  if (activePlayers.length <= 1) {
    game.phase = 'gameover';
    return;
  }
  let attempts = 0;
  do {
    game.turn = (game.turn + 1) % game.players.length;
    attempts++;
  } while (game.players[game.turn].finished && attempts < 4);
  game.phase = 'roll';
  game.dice = 0;
}

// ─── SOCKET.IO ───
function authenticateSocket(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function broadcastRoom(room) {
  const roomData = {
    code: room.code,
    host: room.host,
    status: room.status,
    maxPlayers: room.maxPlayers,
    players: room.players.map(p => ({
      username: p.username,
      color: p.color,
      ready: p.ready
    })),
    game: room.game ? {
      turn: room.game.turn,
      phase: room.game.phase,
      dice: room.game.dice,
      currentColor: room.game.players[room.game.turn]?.color,
      players: room.game.players.map(p => ({
        username: p.username,
        color: p.color,
        tokens: p.tokens,
        finished: p.finished
      }))
    } : null
  };
  io.to(room.code).emit('roomUpdate', roomData);
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // ─── JOIN ROOM ───
  socket.on('joinRoom', ({ token, roomCode }) => {
    console.log(`[joinRoom] socket=${socket.id} roomCode=${roomCode} token=${token ? 'yes' : 'no'}`);
    const decoded = authenticateSocket(token);
    if (!decoded) {
      console.log('[joinRoom] auth failed');
      socket.emit('error', { message: 'Authentication failed' });
      return;
    }

    const username = decoded.username;
    playerSockets.set(socket.id, { username, roomCode: null });

    let room;
    if (roomCode) {
      const code = roomCode.toUpperCase().trim();
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
        console.log(`[joinRoom] invalid code format: "${code}"`);
        socket.emit('error', { message: 'Invalid room code format' });
        return;
      }
      console.log(`[joinRoom] looking up room: "${code}", total rooms: ${rooms.size}, codes: ${[...rooms.keys()].join(',')}`);
      room = rooms.get(code);
      if (!room) {
        console.log('[joinRoom] room not found');
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (room.status !== 'waiting') {
        console.log(`[joinRoom] game already in progress, status: ${room.status}`);
        socket.emit('error', { message: 'Game already in progress' });
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        console.log('[joinRoom] room is full');
        socket.emit('error', { message: 'Room is full' });
        return;
      }
      // Check if already in room (reconnecting)
      if (room.players.some(p => p.username === username)) {
        socket.join(room.code);
        playerSockets.set(socket.id, { username, roomCode: room.code });
        socket.emit('joinedRoom', { roomCode: room.code });
        broadcastRoom(room);
        return;
      }
      const color = assignColor(room);
      room.players.push({ username, color, ready: false });
      console.log(`[joinRoom] ${username} joined room ${code} as ${color}, players: ${room.players.length}`);
    } else {
      room = createRoom(username);
      console.log(`[joinRoom] ${username} created room ${room.code}`);
    }

    socket.join(room.code);
    playerSockets.set(socket.id, { username, roomCode: room.code });
    socket.emit('joinedRoom', { roomCode: room.code });
    broadcastRoom(room);
  });

  // ─── CREATE ROOM ───
  socket.on('createRoom', ({ token }) => {
    const decoded = authenticateSocket(token);
    if (!decoded) {
      socket.emit('error', { message: 'Authentication failed' });
      return;
    }
    const username = decoded.username;
    const room = createRoom(username);
    socket.join(room.code);
    playerSockets.set(socket.id, { username, roomCode: room.code });
    socket.emit('joinedRoom', { roomCode: room.code });
    broadcastRoom(room);
  });

  // ─── TOGGLE READY ───
  socket.on('toggleReady', ({ token }) => {
    const decoded = authenticateSocket(token);
    if (!decoded) return;
    const { username } = decoded;
    const ps = playerSockets.get(socket.id);
    if (!ps || !ps.roomCode) return;
    const room = rooms.get(ps.roomCode);
    if (!room || room.status !== 'waiting') return;
    const player = room.players.find(p => p.username === username);
    if (player) {
      player.ready = !player.ready;
      broadcastRoom(room);
    }
  });

  // ─── START GAME ───
  socket.on('startGame', ({ token }) => {
    const decoded = authenticateSocket(token);
    if (!decoded) return;
    const { username } = decoded;
    const ps = playerSockets.get(socket.id);
    if (!ps || !ps.roomCode) return;
    const room = rooms.get(ps.roomCode);
    if (!room) return;
    if (room.host !== username) {
      socket.emit('error', { message: 'Only the host can start the game' });
      return;
    }
    if (room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' });
      return;
    }
    room.game = initGame(room);
    room.status = 'playing';
    broadcastRoom(room);
  });

  // ─── ROLL DICE ───
  socket.on('rollDice', ({ token }) => {
    const decoded = authenticateSocket(token);
    if (!decoded) return;
    const { username } = decoded;
    const ps = playerSockets.get(socket.id);
    if (!ps || !ps.roomCode) return;
    const room = rooms.get(ps.roomCode);
    if (!room || room.status !== 'playing' || !room.game) return;
    const game = room.game;
    if (game.phase !== 'roll') return;
    const currentPlayer = game.players[game.turn];
    if (currentPlayer.username !== username) return;

    const val = Math.ceil(Math.random() * 6);
    game.dice = val;

    if (!canAnyMove(game, currentPlayer.color, val)) {
      game.phase = 'roll';
      setTimeout(() => {
        nextTurn(game);
        broadcastRoom(room);
      }, 800);
      broadcastRoom(room);
      return;
    }

    game.phase = 'move';
    broadcastRoom(room);
  });

  // ─── MOVE TOKEN ───
  socket.on('moveToken', ({ token, tokenIdx }) => {
    const decoded = authenticateSocket(token);
    if (!decoded) return;
    const { username } = decoded;
    const ps = playerSockets.get(socket.id);
    if (!ps || !ps.roomCode) return;
    const room = rooms.get(ps.roomCode);
    if (!room || room.status !== 'playing' || !room.game) return;
    const game = room.game;
    if (game.phase !== 'move') return;
    const currentPlayer = game.players[game.turn];
    if (currentPlayer.username !== username) return;
    if (!canMoveToken(game, currentPlayer.color, tokenIdx, game.dice)) return;

    const result = doMove(game, currentPlayer.color, tokenIdx, game.dice);

    if (game.phase === 'gameover') {
      room.status = 'finished';
      broadcastRoom(room);
      return;
    }

    if (game.dice === 6 && !currentPlayer.finished) {
      // Extra turn
      game.phase = 'roll';
      game.dice = 0;
    } else {
      nextTurn(game);
    }

    broadcastRoom(room);
  });

  // ─── CHAT ───
  socket.on('sendChat', ({ token, message }) => {
    const decoded = authenticateSocket(token);
    if (!decoded) return;
    const { username } = decoded;
    const ps = playerSockets.get(socket.id);
    if (!ps || !ps.roomCode) return;
    const room = rooms.get(ps.roomCode);
    if (!room) return;
    const chatMsg = { username, message: message.slice(0, 200), timestamp: Date.now() };
    room.chat.push(chatMsg);
    if (room.chat.length > 50) room.chat.shift();
    io.to(room.code).emit('chatMessage', chatMsg);
  });

  // ─── DISCONNECT ───
  socket.on('disconnect', () => {
    const ps = playerSockets.get(socket.id);
    if (ps && ps.roomCode) {
      const room = rooms.get(ps.roomCode);
      if (room && room.status === 'waiting') {
        room.players = room.players.filter(p => p.username !== ps.username);
        if (room.players.length === 0) {
          rooms.delete(ps.roomCode);
        } else {
          if (room.host === ps.username) {
            room.host = room.players[0].username;
          }
          broadcastRoom(room);
        }
      } else if (room) {
        // Player left during game — mark as abandoned
        broadcastRoom(room);
      }
    }
    playerSockets.delete(socket.id);
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ─── HEALTH CHECK ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size, players: playerSockets.size });
});

// ─── SERVE FRONTEND (production) ───
const path = require('path');
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  const fs = require('fs');
  console.log(`[static] path: ${clientBuild}`);
  console.log(`[static] exists: ${fs.existsSync(clientBuild)}`);
  console.log(`[static] index.html: ${fs.existsSync(path.join(clientBuild, 'index.html'))}`);
  app.use(express.static(clientBuild, { index: 'index.html' }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    const idxPath = path.join(clientBuild, 'index.html');
    console.log(`[static] serving index.html for: ${req.path}`);
    res.sendFile(idxPath);
  });
}

server.listen(PORT, () => {
  console.log(`🎲 Ludo server running on port ${PORT}`);
});
