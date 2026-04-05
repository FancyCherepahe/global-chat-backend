const cron = require('node-cron');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

let chatHistory = []

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
    origin: ["http://localhost:3000", "https://global-chat-uq6r.onrender.com/"], // replace with your frontend URL on Render
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
    io.emit('chat message', data);
    chatHistory.push(data);
    if (chatHistory.length > 1000) chatHistory.shift();
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



