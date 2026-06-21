// server.js
import 'dotenv/config';
import fs from 'fs';
import bcrypt from 'bcrypt';
import cron from 'node-cron';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
const upload = multer({ 
  dest: 'uploads/' ,
  limits: {fileSize: 2 * 1024 * 1024}, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('images/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});
const app = express();
const activeSessionCache = new Map();
app.use(express.json());
app.disable('x-powered-by');
app.use('/uploads', express.static('uploads'));

// --- Basic security headers (CSP allows external GA and socket.io) ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://cdn.socket.io"],
      styleSrc: ["'self'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      // 👇 Moved all the URLs here to connectSrc
      connectSrc: [
        "'self'", 
        "https://cdn.socket.io", 
        "wss://global-chat-uq6r.onrender.com", 
        "https://global-chat-uq6r.onrender.com", 
        "ws://localhost:3000", 
        "http://localhost:3000"
      ],
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

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: true,
  handler: (req, res) => {
    res.json({ sucess: false, message: "Too many attemps to log in/ sign in"  })
  }
})

// --- DB pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 15,
  connectionTimeoutMillis: 5000,
});

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

  await pool.query(
    `CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY,
      username TEXT,
      pfplink TEXT,
      role TEXT,
      message TEXT,
      replyto TEXT,
      timestamp TIMESTAMP DEFAULT NOW()
    )`
  )
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

    const uniqueMessageId = crypto.randomUUID();
    // forward to handler
    const user = socket.user;
    if (!user) return;
    const enriched = {
      username: user.username,
      message: data.message,
      messageId: uniqueMessageId,
      pfplink: user.pfplink,
      role: user.role,
      timeStamp: new Date().toISOString(),
      replyto: data.replyto || null
    };
    io.emit('chat message', enriched);
    const replyForDatabase = enriched.replyto ? JSON.stringify(enriched.replyto) : null;
    pool.query('INSERT INTO messages (id, username, message, pfplink, role, replyto) VALUES ($1, $2, $3, $4, $5, $6)', [enriched.messageId, enriched.username, enriched.message, user.pfplink, user.role, replyForDatabase]).catch(err => {
      console.error('Failed to save message to DB', err);
    })
  });
}

app.post("/api/setpfp-upload", upload.single("pfp"), async (req, res) => {
  try {
    const { token } = req.body; // Secure: get the user's secret chat token
    if (!token) {
      return res.json({ success: false, message: "Authentication token required" });
    }
    if (!req.file) {
      return res.json({ success: false, message: "No file uploaded" });
    }

    // 1. Authenticate user using their secret token
    const userLookup = await pool.query("SELECT username FROM users WHERE token=$1", [token]);
    const user = userLookup.rows[0];
    if (!user) {
      return res.json({ success: false, message: "Invalid or expired session token" });
    }

    const username = user.username;
    const pfplink = `/uploads/${req.file.filename}`;

    // 2. Update the profile picture in the database
    await pool.query("UPDATE users SET pfplink=$1 WHERE username=$2", [pfplink, username]);

    // 3. Find all active socket connections belonging to this user and update them in real-time
    for (const [sId, s] of io.sockets.sockets) {
      if (s.user && s.user.username === username) {
        s.user.pfplink = pfplink; // Update in-memory socket profile picture data
        s.emit('update pfp', { value: pfplink }); // Tell the frontend to swap out the image UI
      }
    }

    res.json({ success: true, pfplink });
  } catch (err) {
    console.error("setpfp upload error", err);
    res.json({ success: false, message: "Upload failed due to server error" });
  }
});
// --- API: register ---
app.post('/api/register', authLimiter, upload.single('pfp'),async (req, res) => {
  try {
    const { username, password, pfplink } = req.body;
    if (!isValidUsername(username) || !password) return res.json({ success: false, message: 'Invalid input' });

    const clientIP = req.headers['x-forwarded-for'] || req.ip || '';
    const ipHash = hashIp(clientIP);

    // check bans by username or ipHash
    const banCheck = await pool.query('SELECT 1 FROM bans WHERE username=$1 OR ip=$2 LIMIT 1', [username, ipHash]);
    if (banCheck.rows.length > 0) return res.json({ success: false, message: 'You are banned from this chat' });

    const rawToken = uuidv4();
    const passwordhash = await bcrypt.hash(password, 8);
    const safePfp = req.file?`/uploads/${req.file.filename}`:req.body.pfplink; 

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
app.post('/api/login',authLimiter,  async (req, res) => {
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

    if (activeSessionCache.has(rawToken)) {
      socket.user = activeSessionCache.get(rawToken);
      return next;
    }

    const r = await pool.query('SELECT * FROM users WHERE token=$1', [rawToken]);
    const user = r.rows[0];
    if (!user) return next(new Error('Invalid token'));

    const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '';
    const ipHash = hashIp(clientIP);

    const banCheck = await pool.query('SELECT 1 FROM bans WHERE username=$1 OR ip=$2 LIMIT 1', [user.username, ipHash]);
    if (banCheck.rows.length > 0 || user.role === 'banned') return next(new Error('You are banned'));

    const validatedUserData = {
      id: user.id,
      username: user.username,
      pfplink: user.pfplink,
      role: user.role,
      muteStatus: user.mutestatus
    };

    activeSessionCache.set(rawToken, validatedUserData);

    socket.user = validatedUserData
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

  let cachedHistory = null;
  let lastCacheTime = 0
  const CHACE_LIFETIME_MS = 2000;

  socket.on('request history', async () => {
    try {
      const now = Date.now()
      if (cachedHistory && (now - lastCacheTime) < CHACE_LIFETIME_MS){
        socket.emit('chat history, cachedHistory')
        return;
      }

      const history = await pool.query('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100')

      const formattedHistory = history.rows.reverse().map(row => {
        let parsedReply = null;
        if (row.replyto) {
          try {
            parsedReply = JSON.parse(row.replyto);
          } catch (err) {
            console.error('Failed to parse replyto', err);
          }
        }

        return {
          messageId: row.id,
          username: row.username,
          pfplink: row.pfplink,
          role: row.role,
          message: row.message,
          timeStamp: row.timestamp,
          replyto: parsedReply
        }
      });

      cachedHistory = formattedHistory;
      lastCacheTime = now;

      socket.emit('chat history', formattedHistory);
    } catch (err) {
      console.error('Failed to fetch message history', err);
    }
  });

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

      // 1. Clean the command string and remove a leading slash if present
      const rawCmd = data.command.trim();
      const cleanCmd = rawCmd.startsWith('/') ? rawCmd.slice(1) : rawCmd;

      // 2. Split by one or more whitespace characters to extract command & args cleanly
      const parts = cleanCmd.split(/\s+/);
      const commandName = parts[0].toLowerCase();
      const args = parts.slice(1);

      // --- help command ---
      if (commandName === 'help') {
        const userCommands = ['tell [username] [message]', 'setpfp [id]/upload'];
        const modCommands = ['clear', 'kick [username]', 'ban [username]', 'unban [username]', 'mute [username]', 'unmute [username]'];
        const ownerCommands = ['setrole [username] [role]'];
        let commands = [...userCommands];
        if (role === 'moderator' || role === 'owner') commands = commands.concat(modCommands);
        if (role === 'owner') commands = commands.concat(ownerCommands);
        socket.emit('system message', { text: `Available commands: ${commands.join(', ')}` });
        return;
      }

      // --- tell command ---
      if (commandName === 'tell') {
        const target = args[0];
        const msg = args.slice(1).join(' ');
        if (!target || !msg) { 
          socket.emit('system message', { text: 'Usage: tell [username] [message]' });
          return; 
        }
        let found = false;
        for (const [sId, s] of io.sockets.sockets) {
          if (s.user && s.user.username === target) {
            s.emit('system message', { text: `${socket.user.username} whispers to you: ${msg}` });
            found = true;
            break;
          }
        }
        if (!found) socket.emit('system message', { text: 'User not found.' });
        return;
      }


if (commandName === 'setpfp') {
  const input = args[0];
  if (!input) { 
    socket.emit('system message', { text: 'Usage: /setpfp [1-7], /setpfp [URL], or /setpfp upload' });
    return; 
  }

 
  if (input.toLowerCase() === 'upload') {
    socket.emit('trigger pfp file picker');
    return;
  }

  let newPfpUrl = null;
  const pfpId = parseInt(input, 10);
  
  const setPfpPictures = [
    { id: 1, url: '/images/stock-pfp/uzi-pfp.png' },
    { id: 2, url: '/images/stock-pfp/n-pfp.png' },
    { id: 3, url: '/images/stock-pfp/v-pfp.png' },
    { id: 4, url: '/images/stock-pfp/cyn-pfp.png' },
    { id: 5, url: '/images/stock-pfp/lizzie-pfp.png' },
    { id: 6, url: '/images/stock-pfp/doll-pfp.png' },
    { id: 7, url: '/images/stock-pfp/absolute-solver-pfp.png' }
  ];

  if (!isNaN(pfpId)) {
    const selected = setPfpPictures.find(p => p.id === pfpId);
    if (selected) newPfpUrl = selected.url;
  }

  if (!newPfpUrl) {
    if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('/uploads/')) {
      newPfpUrl = input;
    } else {
      socket.emit('system message', { text: 'Invalid ID, link, or sub-command. Try /setpfp upload' });
      return;
    }
  }

  await pool.query('UPDATE users SET pfplink=$1 WHERE username=$2', [newPfpUrl, socket.user.username]);
  socket.user.pfplink = newPfpUrl;
  socket.emit('system message', { text: 'Your profile picture was updated!' });
  
  for (const [sId, s] of io.sockets.sockets) {
    if (s.user && s.user.username === socket.user.username) {
      s.user.pfplink = newPfpUrl;
      s.emit('update pfp', { value: newPfpUrl });
    }
  }
  return;
}
      // --- Privileged commands (owner / moderator) ---
      if (role === 'owner' || role === 'moderator') {
        
        // clear command
        if (commandName === 'clear') {
          await pool.query('TRUNCATE TABLE messages;');
          io.emit('clear chat');
          io.emit('system message', { text: `Chat history was cleared by ${socket.user.username}` });
          return;
        }

        // kick command
        if (commandName === 'kick') {
          const target = args[0];
          if (!target) { 
            socket.emit('system message', { text: 'Usage: kick [username]' }); 
            return;
          }
          for (const [sId, s] of io.sockets.sockets) {
            if (s.user && s.user.username === target) {
              s.emit('kicked user');
              s.disconnect(true);
              io.emit('system message', { text: `${target} was kicked by ${socket.user.username}` });
              if (targetToken) activeSessionCache.delete(targetToken)
              break;
            }
          }
          return;
        }

        // ban command
        // --- ban command ---
if (commandName === 'ban') {
  const target = args[0];
  if (!target) { 
    socket.emit('system message', { text: 'Usage: ban [username]' });
    return;
  }

  const r = await pool.query('SELECT role, token FROM users WHERE username=$1', [target]);
  if (r.rows.length === 0) { 
    socket.emit('system message', { text: 'User not found' });
    return;
  }
  const targetUser = r.rows[0];
  if (targetUser.role === 'owner' || targetUser.role === 'moderator') { 
    socket.emit('system message', { text: 'Cannot ban owner/moderator' });
    return;
  }

  // 1. Update database role
  await pool.query('UPDATE users SET role=$1 WHERE username=$2', ['banned', target]);

  if (targetToken) activeSessionCache.delete(targetToken)

  // 2. Find target's active socket to capture THEIR IP and disconnect them
  let targetIpHash = null;
  const targetToken = targetUser.token;

  for (const [sId, s] of io.sockets.sockets) {
    if (s.user && s.user.username === target) {
      const clientIP = s.handshake.headers['x-forwarded-for'] || s.handshake.address || '';
      targetIpHash = hashIp(clientIP);
      
      s.emit('system message', { text: 'You have been banned' });
      s.disconnect(true);
    }
  }

  // 3. Save the TARGET's data to the bans table (fallback to null if offline)
  await pool.query('INSERT INTO bans (username, ip, token) VALUES ($1, $2, $3)', [target, targetIpHash, targetToken]);

  if (targetIpHash) bannedIPs.add(targetIpHash);
  if (targetToken) bannedTokens.add(targetToken);

  io.emit('system message', { text: `${target} was banned by ${socket.user.username}` });
  return;
}

        // unban command
        if (commandName === 'unban') {
          const target = args[0];
          if (!target) { 
            socket.emit('system message', { text: 'Usage: unban [username]' }); 
            return;
          }

          await pool.query('UPDATE users SET role=$1 WHERE username=$2', ['user', target]);
          const banTruth = await pool.query('SELECT ip, token FROM bans WHERE username=$1', [target]);
          await pool.query('DELETE FROM bans WHERE username=$1', [target]);
          if (banTruth.rows.length > 0) {
            const { ip, token } = banTruth.rows[0];
            if (ip) bannedIPs.delete(ip);
            if (token) bannedTokens.delete(token);
          }

          for (const [sId, s] of io.sockets.sockets) {
            if (s.user && s.user.username === target) s.emit('unbanned');
          }
          io.emit('system message', { text: `${target} was unbanned by ${socket.user.username}` });
          return;
        }

        // mute command
        if (commandName === 'mute') {
          const target = args[0];
          if (!target) { 
            socket.emit('system message', { text: 'Usage: mute [username]' }); 
            return;
          }
          await pool.query('UPDATE users SET mutestatus=$1 WHERE username=$2', ['muted', target]);
          io.emit('system message', { text: `${target} was muted by ${socket.user.username}` });
          for (const [sId, s] of io.sockets.sockets) {
            if (s.user && s.user.username === target) s.emit('muted', { target });
          }
          return;
        }

        // unmute command
        if (commandName === 'unmute') {
          const target = args[0];
          if (!target) { 
            socket.emit('system message', { text: 'Usage: unmute [username]' }); 
            return;
          }
          await pool.query('UPDATE users SET mutestatus=$1 WHERE username=$2', ['unmuted', target]);
          io.emit('system message', { text: `${target} was unmuted by ${socket.user.username}` });
          for (const [sId, s] of io.sockets.sockets) {
            if (s.user && s.user.username === target) s.emit('unmuted');
          }
          return;
        }

        // setrole command
        if (commandName === 'setrole') {
          const target = args[0];
          const value = args[1];
          if (socket.user.role !== 'owner') { 
            socket.emit('system message', { text: 'You do not have permission' });
            return; 
          }
          if (!target || !value) { 
            socket.emit('system message', { text: 'Usage: setrole [username] [role]' });
            return; 
          }
          await pool.query('UPDATE users SET role=$1 WHERE username=$2', [value, target]);
          const updated = await pool.query('SELECT * FROM users WHERE username=$1', [target]);
          const updatedUser = updated.rows[0];
          for (const [sId, s] of io.sockets.sockets) {
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
      const targetMsg = await pool.query('SELECT * FROM messages WHERE id=$1', [data.messageId]);
      if (!targetMsg.rows[0]) return;
      const secureUsername  = socket.user?.username;
      const r = await pool.query('SELECT role FROM users WHERE username=$1', [secureUsername]);
      const role = r.rows[0]?.role;
      if (role === 'owner' || role === 'moderator' || targetMsg.rows[0].username === secureUsername) {
        await pool.query('DELETE FROM messages WHERE id=$1', [data.messageId])
        io.emit("delete message", { messageId: data.messageId });
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
  // Backend (server.txt) socket listener:
socket.on('pfp_changed_notify', (data) => {
    // Broadcast to everyone else that this socket's user has a new avatar
    socket.broadcast.emit('update pfp', { username: socket.username, value: data.newPfpUrl });
});
});

// --- Daily cron ---
cron.schedule('0 0 * * 0', async () => {
  await pool.query('DELETE FROM messages WHERE timestamp < NOW() - INTERVAL \'3 days\'');
  io.emit('system message', { text: 'Chat history cleared for the new week' });
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
