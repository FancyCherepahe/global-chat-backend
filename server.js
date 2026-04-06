const fs = require('fs');
const cron = require('node-cron');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const usersFile = "./user.json"
const bcrypt = require('bcrypt');
const { timeStamp } = require('console');

const app = express();

let chatHistory = []

app.use(express.json())

function loadUsers() {
  if (!fs.existsSync(usersFile)) return [];
  return JSON.parse(fs.readFileSync(usersFile));
}

function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

app.post("/api/register", async (req, res) => {
  
  const { username, password, pfpLink } = req.body;

  if (!username || !password) {
    return res.json({ success: false, message: "Missing fields"})
  }

  const users = loadUsers();

  if (users.find(u => u.username === username)) {
    return res.json({ success: false, message: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    username,
    passwordHash,
    pfpLink,
    createdAt: new Date().toISOString()
  }

  users.push(newUser);
  saveUsers(users);

  res.json({ success: true, user: {username, pfpLink} ,message: "User registered successfully" });
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  
  const users = loadUsers();
  const user = users.find(u => u.username === username);

  if (!user) return res.json({ success: false, message: "User not found" });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.json({success: true, message: "Wrong password"})
   
  res.json({
    success: true,
    message: "Login successgully",
    user: {username: user.username, pfpLink: user.pfpLink}
  })
});


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



