require('dotenv').config();
const fs = require('fs');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { timeStamp } = require('console');
const { Pool } = require('pg')

const app = express();

let chatHistory = []

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

app.use(express.json())

async function init() {  

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    passwordhash TEXT,
    pfplink TEXT,
    role TEXT DEFAULT 'user',
    createdat TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("everything is OK")

app.post("/api/register", async (req, res) => {
  
  const { username, password, pfplink } = req.body;

  try {
    const passwordhash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, passwordhash, pfplink, role, createdat) VALUES ($1, $2, $3, $4, NOW())',
      [username, passwordhash, pfplink, "user"]
    );
    res.json({ success: true, user: {username, pfplink, role: 'user'} });
  } catch (err){
    res.json({ success: false, message: 'Username already exists' })
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username])

  const user = result.rows[0] 

  if (user && await bcrypt.compare(password, user.passwordhash)) {
    res.json ({ success: true, user: {username: user.username, pfplink: user.pfplink, role: user.role}})
  } else {
    res.json ({ success: false, message: 'Invalid username or password'})
  }
  
  })



// Serve static files if needed (frontend build)
app.use(express.static('public'));

// Simple API route
app.get('/api/messages', (req, res) => {
  res.json({ message: 'Hello from GlobalChat backend!' });
});

// Create HTTP server (Render handles HTTPS for you)
const server = http.createServer(app);

// Attach Socket.IO for chat
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://global-chat-uq6r.onrender.com/"], 
    methods: ["GET", "POST"]
  }
});

// Handle chat connections
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on("request history", () => {
    socket.emit("chat history", chatHistory.slice(-100));
  });

  socket.on('chat message', (data) => {
    
    io.emit('chat message', data)

    chatHistory.push(data);
    if (chatHistory.length > 1000) chatHistory.shift()
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  

});
cron.schedule('0 0 * * *', () => {
  chatHistory = [];
  io.emit("system message", { text: "Chat history cleared for the new day" });
  console.log("Chat history reset");
},{timezone: 'UTC'});
// Render sets PORT automatically
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}, link to local host: http://localhost:${PORT}`);
});
}

init();

