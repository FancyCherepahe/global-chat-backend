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
function clearChat() {
  chatHistory = [];
  socket.emit("system message", { text: "Chat history cleared for the new day" });
  console.log("Chat history reset");
}

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bans(
    id SERIAL PRIMARY KEY,
    username TEXT,
    ip TEXT,
    token TEXT,
    banned_at TIMESTAMP DEFAULT NOW()
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
    const banCheck = await pool.query("SELECT * FROM bans WHERE username=$1 OR ip=$2 OR token=$3",
      [username, req.ip, req.body.token])
    if (banCheck.rows.length > 0 || user.role === "banned") {
      return res.json({ success: false, message: "You are banned from this chat"})
    }
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
    const banCheck = await pool.query("SELECT * FROM bans WHERE username=$1 OR ip=$2 OR token=$3",
      [username, req.ip, req.body.token])
    if (banCheck.rows.length > 0 || user.role === "banned") {
      return res.json({ success: false, message: "You are banned from this chat"})
    }
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

let bannedIPs = new Set();
let bannedTokens = new Set();

// Handle chat connections
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on("register username", (username) =>{
    socket.username = username;
    console.log("Rerister username:", username, "for socket:", socket.id)
  })

  socket.on("request history", () => {
    socket.emit("chat history", chatHistory.slice(-100));
  });

  

  socket.on("command", async (data) => {
    const result = await pool.query(
      "SELECT role FROM users WHERE username=$1",
      [data.username]
    );
    const role = result.rows[0].role;

    if (role === "owner" || role === "moderator") {
      if (data.command === "clear"){
        chatHistory = [];
        io.emit("clear chat");
        io.emit("system message", { text: `Chat history was cleared by ${data.username}` });
        console.log("Chat history reset");
      }
      if (data.command === "kick" && data.target) {
        for (let [id, s] of io.sockets.sockets) {
          if (s.username === data.target){
            s.emit("kicked user");
            s.disconnect(true);
            io.emit("system message", {text: `${data.target} was kicked by ${data.username}`});
            console.log("User was Kicked!");
            break;
          }
        }
      }
      if (data.command === "ban" && data.target) {
        for (let [id, s] of io.sockets.sockets) {
          if (s.username === data.target){
            await pool.query("UPDATE users Set role='banned' WHERE username=$1", [data.target]);

            await pool.query("INSERT INTO bans (username, ip, token) VALUES ($1, $2, $3)", 
              [data.target, s.handshake.address, s.handshake.auth.token]);

              bannedIPs.add(s.handshake.address);
              bannedTokens.add(s.handshake.auth.token);

              s.emit("system message", { text: "You have been banned"});
              s.disconnect(true);
              io.emit("system message", {text: `${data.target} was banned by ${data.username} `});
              break;
          }
        }
      }
      if (data.command === "mute" && data.target) {
        for (let [id, s] of io.sockets.sockets){
          if (s.username === data.target){
            s.emit("muted");
            s.emit("system message", {text: `You have been muted!`});
            io.emit("system message", {text: `${data.target} was muted by ${data.username}`});
            break;
          }
        }
      }
      if (data.command === "unmute" && data.target) {
        for (let [id, s] of io.sockets.sockets){
          if (s.username === data.target){
            s.emit("unmuted");
            s.emit("system message", {text: `You have been unmuted!`});
            io.emit("system message", {text: `${data.target} was unmuted by ${data.username}`});
            break;
          }
        }
      }  
    } 
    if (role === "owner"){
      if (data.command === "setrole" && data.target && data.value) {
        for (let [id, s] of io.sockets.sockets){
            if (s.username === data.target){
            await pool.query(
              "UPDATE users SET role=$1 WHERE username=$2", [data.value, data.target]
            );
            io.emit("system message", {text: `${data.target}'s role was changed to ${data.value} by ${data.username}`});
            s.emit("changed role", { value: data.value })
            console.log("New role have been set!")
            break;
          }
        }
      }
    } else {
      socket.emit("system message", {text : "You don't have permission."})
    }
  })

  socket.on('chat message', async (data) => {
    
    
    const result = await pool.query(
      "SELECT username, pfplink, role FROM users Where username=$1",
      [data.username]
    )

    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      const enrichedMessage = {
        username: user.username,
        pfplink: user.pfplink,
        role: user.role,
        message: data.message,
        timeStamp: Date.now()
      }
      io.emit('chat message', enrichedMessage);
      
      chatHistory.push(enrichedMessage);
      if (chatHistory.length > 1000) chatHistory.shift()
        
      console.log("Enriched role:", user.role);
    }

    
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}, link to local host: http://localhost:${PORT}`);
});
}

init();

