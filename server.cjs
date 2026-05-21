// server.js
require('dotenv').config();
const fs = require('fs');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());
app.disable('x-powered-by');

// --- Basic security headers (CSP allows external GA and socket.io) ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.googletagmanager.com", "https://cdn.socket.io"],
      styleSrc: ["'self'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdn.socket.io"],
      objectSrc: ["'none'"]
    }
  }
}));

// --- CORS: adjust origin to your frontend(s) ---
app.use(cors({
  origin: ['http://localhost:3000', 'https://global-chat-uq6r.onrender.com'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// --- Rate limiter for API endpoints ---
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
}));

// --- Helpers ---
function isValidUsername(name) {
  return typeof name === 'string' && /^[A-Za-z0-9_\-]{3,24}$/.test(name);
}

function hashIp(ip) {
  return crypto.createHash('sha256').update((ip || '') + (process.env.IP_PEPPER || '')).digest('hex');
}

// --- DB pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- In-memory chat state ---
let chatHistory = [];

// --- Stickers (unchanged) ---
const masterStickers = {
  ":1_uzi_heart:": "images/stickers/sticker-pack-1-1.png",
  ":1_uzi_sad:": "images/stickers/sticker-pack-1-2.png",
  ":1_uzi_angry:": "images/stickers/sticker-pack-1-3.png",
  ":1_uzi_phew:": "images/stickers/sticker-pack-1-4.png",
  ":1_uzi_uwu:": "images/stickers/sticker-pack-1-5.png",
  ":2_uzi_happy:": "images/stickers/sticker-pack-2-1.png",
  ":2_n_happy:": "images/stickers/sticker-pack-2-2.png",
  ":2_v_angry:": "images/stickers/sticker-pack-2-3.png",
  ":2_lizzy_on_phone_angry:": "images/stickers/sticker-pack-2-4.png",
  ":2_j_silly:": "images/stickers/sticker-pack-2-5.png",
  ":2_doll_serious:": "images/stickers/sticker-pack-2-6.png",
  ":2_thad_chill:": "images/stickers/sticker-pack-2-7.png"
};

// --- Ensure schema ---
async function ensureSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  `).catch(() => { /* ignore if not allowed */ });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      passwordhash TEXT,
      pfplink TEXT,
      role TEXT DEFAULT 'user',
      mutestatus TEXT DEFAULT 'unmuted',
      token TEXT,
      createdat TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bans (
      id SERIAL PRIMARY KEY,
      username TEXT,
      ip TEXT,
      token TEXT,
      banned_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// --- Rate limiter for sockets (simple token bucket per socket) ---
function attachSocketRateLimiter(socket, { capacity = 5, refillInterval = 1000 } = {}) {
  socket.rate = { tokens: capacity, capacity, lastRefill: Date.now() };
  socket.on('chat message', (data) => {
    const now = Date.now();
    const elapsed = now - socket.rate.lastRefill;
    const refill = Math.floor(elapsed / refillInterval);
    if (refill > 0) {
      socket.rate.tokens = Math.min(socket.rate.capacity, socket.rate.tokens + refill);
      socket.rate.lastRefill = now;
    }
    if (!data || typeof data.message !== 'string' || data.message.trim().length === 0) return;
    if (data.message.length > 2000) {
      socket.emit('system message', { text: 'Message too long' });
      return;
    }
    if (socket.rate.tokens <= 0) {
      socket.emit('system message', { text: 'You are sending messages too fast' });
      return;
    }
    socket.rate.tokens -= 1;
    // forward to handler
    const user = socket.user;
    if (!user) return;
    const enriched = {
      username: user.username,
      pfplink: user.pfplink,
      role: user.role,
      message: data.message,
      messageId: data.messageId || crypto.randomUUID(),
      timeStamp: new Date().toISOString(),
      replyTo: data.replyTo || null
    };
    io.emit('chat message', enriched);
    chatHistory.push(enriched);
    if (chatHistory.length > 1000) chatHistory.shift();
  });
}

// --- API: register ---
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, pfplink } = req.body;
    if (!isValidUsername(username) || !password) return res.json({ success: false, message: 'Invalid input' });

    const clientIP = req.headers['x-forwarded-for'] || req.ip || '';
    const ipHash = hashIp(clientIP);

    // check bans by username or ipHash
    const banCheck = await pool.query('SELECT 1 FROM bans WHERE username=$1 OR ip=$2 LIMIT 1', [username, ipHash]);
    if (banCheck.rows.length > 0) return res.json({ success: false, message: 'You are banned from this chat' });

    const rawToken = uuidv4();
    const passwordhash = await bcrypt.hash(password, 10);
    const safePfp = pfplink

    await pool.query(
      'INSERT INTO users (username, passwordhash, pfplink, role, token, createdat) VALUES ($1,$2,$3,$4,$5,NOW())',
      [username, passwordhash, safePfp, 'user', rawToken]
    );

    return res.json({ success: true, user: { username, pfplink: safePfp, role: 'user', token: rawToken } });
  } catch (err) {
    console.error('Register error', err);
    return res.json({ success: false, message: 'Username already exists or server error' });
  }
});

// --- API: login (rotate raw token) ---
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, message: 'Invalid input' });

    const r = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    const user = r.rows[0];
    if (!user || !(await bcrypt.compare(password, user.passwordhash))) {
      return res.json({ success: false, message: 'Invalid username or password' });
    }

    // rotate raw token
    const rawToken = uuidv4();
    await pool.query('UPDATE users SET token=$1 WHERE username=$2', [rawToken, username]);

    // ban check by username or hashed IP (we store hashed IP in bans)
    const clientIP = req.headers['x-forwarded-for'] || req.ip || '';
    const ipHash = hashIp(clientIP);
    const banCheck = await pool.query('SELECT 1 FROM bans WHERE username=$1 OR ip=$2 LIMIT 1', [username, ipHash]);
    if (banCheck.rows.length > 0 || user.role === 'banned') {
      return res.json({ success: false, message: 'You are banned from this chat' });
    }

    return res.json({
      success: true,
      user: {
        username: user.username,
        pfplink: user.pfplink,
        role: user.role,
        mutestatus: user.mutestatus,
        token: rawToken
      }
    });
  } catch (err) {
    console.error('Login error', err);
    return res.json({ success: false, message: 'Login error' });
  }
});

// --- API: autologin (raw token) ---
app.post('/api/autologin', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.json({ success: false, message: 'Invalid token' });

    const r = await pool.query('SELECT * FROM users WHERE token=$1', [token]);
    const user = r.rows[0];
    if (!user) return res.json({ success: false, message: 'Invalid token' });

    const clientIP = req.headers['x-forwarded-for'] || req.ip || '';
    const ipHash = hashIp(clientIP);
    const banCheck = await pool.query('SELECT 1 FROM bans WHERE username=$1 OR ip=$2 LIMIT 1', [user.username, ipHash]);
    if (banCheck.rows.length > 0 || user.role === 'banned') {
      return res.json({ success: false, message: 'You are banned from this chat' });
    }

    return res.json({
      success: true,
      user: {
        username: user.username,
        pfplink: user.pfplink,
        role: user.role,
        mutestatus: user.mutestatus,
        token: user.token
      }
    });
  } catch (err) {
    console.error('Autologin error', err);
    return res.json({ success: false, message: 'Auto-login failed' });
  }
});

// --- API: stickers ---
app.get('/api/stickers', (req, res) => {
  res.json(masterStickers);
});

// --- Serve static files ---
app.use(express.static('public'));
app.get('/api/messages', (req, res) => res.json({ message: 'Hello from GlobalChat backend!' }));

// --- HTTP + Socket.IO ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://global-chat-uq6r.onrender.com'],
    methods: ['GET', 'POST']
  }
});

// --- Socket auth: raw token lookup, ban check by hashed IP only ---
io.use(async (socket, next) => {
  try {
    const rawToken = socket.handshake.auth?.token;
    if (!rawToken) return next(new Error('Invalid token'));

    const r = await pool.query('SELECT * FROM users WHERE token=$1', [rawToken]);
    const user = r.rows[0];
    if (!user) return next(new Error('Invalid token'));

    const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '';
    const ipHash = hashIp(clientIP);

    const banCheck = await pool.query('SELECT 1 FROM bans WHERE username=$1 OR ip=$2 LIMIT 1', [user.username, ipHash]);
    if (banCheck.rows.length > 0 || user.role === 'banned') return next(new Error('You are banned'));

    socket.user = {
      id: user.id,
      username: user.username,
      pfplink: user.pfplink,
      role: user.role,
      muteStatus: user.mutestatus
    };
    return next();
  } catch (err) {
    console.error('Socket auth error', err);
    return next(new Error('Authentication error'));
  }
});

// --- In-memory ban caches (optional) ---
const bannedIPs = new Set();
const bannedTokens = new Set();

// --- Socket connection handler ---
io.on('connection', (socket) => {
  attachSocketRateLimiter(socket, { capacity: 5, refillInterval: 1000 });

  socket.on('request history', () => socket.emit('chat history', chatHistory.slice(-100)));

  socket.on('register username', (username) => {
    socket.username = username;
  });

  socket.on('command', async (data) => {
    try {
      const role = socket.user?.role;
      if (!data || typeof data.command !== 'string') {
        socket.emit('system message', { text: 'Invalid command' });
        return;
      }
      const cmd = data.command.trim();

      // help
      if (cmd === 'help') {
        const userCommands = ['tell [username] [message]', 'setpfp [id]'];
        const modCommands = ['clear', 'kick [username]', 'ban [username]', 'unban [username]', 'mute [username]', 'unmute [username]'];
        const ownerCommands = ['setrole [username] [role]'];
        let commands = [...userCommands];
        if (role === 'moderator' || role === 'owner') commands = commands.concat(modCommands);
        if (role === 'owner') commands = commands.concat(ownerCommands);
        socket.emit('system message', { text: `Available commands: ${commands.join(', ')}` });
        return;
      }

      // tell
      if (cmd.startsWith('tell')) {
        const parts = cmd.split(' ');
        const target = parts[1];
        const msg = parts.slice(2).join(' ');
        if (!target || !msg) { socket.emit('system message', { text: 'Usage: tell [username] [message]' }); return; }
        let found = false;
        for (const [id, s] of io.sockets.sockets) {
          if (s.user && s.user.username === target) {
            s.emit('system message', { text: `${socket.user.username} whispers to you: ${msg}` });
            found = true;
            break;
          }
        }
        if (!found) socket.emit('system message', { text: 'User not found.' });
        return;
      }

      // setpfp
      if (cmd.startsWith('setpfp')) {
        const parts = cmd.split(' ');
        const id = parseInt(parts[1], 10);
        const setPfpPictures = [
          { id: 1, url: '/images/stock-pfp/uzi-pfp.png' },
          { id: 2, url: '/images/stock-pfp/n-pfp.png' },
          { id: 3, url: '/images/stock-pfp/v-pfp.png' },
          { id: 4, url: '/images/stock-pfp/cyn-pfp.png' },
          { id: 5, url: '/images/stock-pfp/lizzie-pfp.png' },
          { id: 6, url: '/images/stock-pfp/doll-pfp.png' },
          { id: 7, url: '/images/stock-pfp/absolute-solver-pfp.png' }
        ];
        const selected = setPfpPictures.find(p => p.id === id);
        if (!selected) { socket.emit('system message', { text: 'Invalid profile picture id' }); return; }
        await pool.query('UPDATE users SET pfplink=$1 WHERE username=$2', [selected.url, socket.user.username]);
        socket.user.pfplink = selected.url;
        socket.emit('system message', { text: 'Your profile picture was updated' });
        socket.emit('update pfp', { value: selected.url });
        for (const [id, s] of io.sockets.sockets) {
          if (s.user && s.user.username === socket.user.username) {
            s.user.pfplink = selected.url;
            s.emit('update pfp', { value: selected.url });
          }
        }
        return;
      }

      // privileged commands
      if (role === 'owner' || role === 'moderator') {
        if (cmd === 'clear') {
          chatHistory = [];
          io.emit('clear chat');
          io.emit('system message', { text: `Chat history was cleared by ${socket.user.username}` });
          return;
        }

        if (cmd.startsWith('kick')) {
          const parts = cmd.split(' ');
          const target = parts[1];
          if (!target) { socket.emit('system message', { text: 'Usage: kick [username]' }); return; }
          for (const [id, s] of io.sockets.sockets) {
            if (s.user && s.user.username === target) {
              s.emit('kicked user');
              s.disconnect(true);
              io.emit('system message', { text: `${target} was kicked by ${socket.user.username}` });
              break;
            }
          }
          return;
        }

        if (cmd.startsWith('ban')) {
          const parts = cmd.split(' ');
          const target = parts[1];
          if (!target) { socket.emit('system message', { text: 'Usage: ban [username]' }); return; }

          const r = await pool.query('SELECT role FROM users WHERE username=$1', [target]);
          if (r.rows.length === 0) { socket.emit('system message', { text: 'User not found' }); return; }
          const targetRole = r.rows[0].role;
          if (targetRole === 'owner' || targetRole === 'moderator') { socket.emit('system message', { text: 'Cannot ban owner/moderator' }); return; }

          await pool.query('UPDATE users SET role=$1 WHERE username=$2', ['banned', target]);

          // hash the admin's IP for storage (we store hashed IP only)
          const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '';
          const ipHash = hashIp(clientIP);

          // store ban row: username + hashed ip; token column left for compatibility (we store raw token if available)
          const adminRawToken = socket.handshake.auth?.token || null;
          await pool.query('INSERT INTO bans (username, ip, token) VALUES ($1,$2,$3)', [target, ipHash, adminRawToken]);

          bannedIPs.add(ipHash);
          if (adminRawToken) bannedTokens.add(adminRawToken);

          for (const [id, s] of io.sockets.sockets) {
            if (s.user && s.user.username === target) {
              s.emit('system message', { text: 'You have been banned' });
              s.disconnect(true);
            }
          }
          io.emit('system message', { text: `${target} was banned by ${socket.user.username}` });
          return;
        }

        if (cmd.startsWith('unban')) {
          const parts = cmd.split(' ');
          const target = parts[1];
          if (!target) { socket.emit('system message', { text: 'Usage: unban [username]' }); return; }

          await pool.query('UPDATE users SET role=$1 WHERE username=$2', ['user', target]);
          const banTruth = await pool.query('SELECT ip, token FROM bans WHERE username=$1', [target]);
          await pool.query('DELETE FROM bans WHERE username=$1', [target]);

          if (banTruth.rows.length > 0) {
            const { ip, token } = banTruth.rows[0];
            if (ip) bannedIPs.delete(ip);
            if (token) bannedTokens.delete(token);
          }

          for (const [id, s] of io.sockets.sockets) {
            if (s.user && s.user.username === target) s.emit('unbanned');
          }
          io.emit('system message', { text: `${target} was unbanned by ${socket.user.username}` });
          return;
        }

        if (cmd.startsWith('mute')) {
          const parts = cmd.split(' ');
          const target = parts[1];
          if (!target) { socket.emit('system message', { text: 'Usage: mute [username]' }); return; }
          await pool.query('UPDATE users SET mutestatus=$1 WHERE username=$2', ['muted', target]);
          io.emit('system message', { text: `${target} was muted by ${socket.user.username}` });
          for (const [id, s] of io.sockets.sockets) {
            if (s.user && s.user.username === target) s.emit('muted', { target });
          }
          return;
        }

        if (cmd.startsWith('unmute')) {
          const parts = cmd.split(' ');
          const target = parts[1];
          if (!target) { socket.emit('system message', { text: 'Usage: unmute [username]' }); return; }
          await pool.query('UPDATE users SET mutestatus=$1 WHERE username=$2', ['unmuted', target]);
          io.emit('system message', { text: `${target} was unmuted by ${socket.user.username}` });
          for (const [id, s] of io.sockets.sockets) {
            if (s.user && s.user.username === target) s.emit('unmuted');
          }
          return;
        }

        if (cmd.startsWith('setrole')) {
          const parts = cmd.split(' ');
          const target = parts[1];
          const value = parts[2];
          if (socket.user.role !== 'owner') { socket.emit('system message', { text: 'You do not have permission' }); return; }
          if (!target || !value) { socket.emit('system message', { text: 'Usage: setrole [username] [role]' }); return; }
          await pool.query('UPDATE users SET role=$1 WHERE username=$2', [value, target]);
          const updated = await pool.query('SELECT * FROM users WHERE username=$1', [target]);
          const updatedUser = updated.rows[0];
          for (const [id, s] of io.sockets.sockets) {
            if (s.user && s.user.username === target) {
              s.user = { id: updatedUser.id, username: updatedUser.username, pfplink: updatedUser.pfplink, role: updatedUser.role, muteStatus: updatedUser.mutestatus };
              s.emit('changed role', { value });
            }
          }
          io.emit('system message', { text: `${target}'s role was changed to ${value} by ${socket.user.username}` });
          return;
        }
      } // end privileged
      socket.emit('system message', { text: 'Unknown or unauthorized command' });
    } catch (err) {
      console.error('Command handler error', err);
      socket.emit('system message', { text: 'Command error' });
    }
  });

  socket.on('delete message', async (data) => {
    try {
      if (!data || !data.messageId) return;
      const targetMsg = chatHistory.find(m => m.messageId === data.messageId);
      if (!targetMsg) return;
      const r = await pool.query('SELECT role FROM users WHERE username=$1', [data.username]);
      const role = r.rows[0]?.role;
      if (role === 'owner' || role === 'moderator' || targetMsg.username === data.username) {
        chatHistory = chatHistory.filter(m => m.messageId !== data.messageId);
        io.emit('delete message', { messageId: data.messageId });
      }
    } catch (err) {
      console.error('Delete message error', err);
    }
  });

  socket.on('logout', async (data) => {
    try {
      if (!data || !data.username || !data.userToken) return;
      const r = await pool.query('SELECT token FROM users WHERE username=$1', [data.username]);
      const dbToken = r.rows[0]?.token;
      if (dbToken && dbToken === data.userToken) {
        await pool.query('UPDATE users SET token=NULL WHERE username=$1', [data.username]);
        socket.emit('system message', { text: 'Logged out' });
      }
    } catch (err) {
      console.error('Logout error', err);
    }
  });

  socket.on('disconnect', () => {
    // nothing special
  });
});

// --- Daily cron ---
cron.schedule('0 0 * * *', () => {
  chatHistory = [];
  io.emit('system message', { text: 'Chat history cleared for the new day' });
  io.emit('unmuted');
}, { timezone: 'UTC' });

// --- Start server ---
(async () => {
  try {
    await ensureSchema();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
})();
