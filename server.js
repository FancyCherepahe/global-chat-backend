const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

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
    origin: "*", // replace with your frontend URL on Render
    methods: ["GET", "POST"]
  }
});

// Handle chat connections
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('chat message', (data) => {
    data = { username, pfpLink, message}
    // broadcast to all clients
    io.emit('chat message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Render sets PORT automatically
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}, link to local host: http://localhost:${PORT}`);
});