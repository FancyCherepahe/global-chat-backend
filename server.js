const fs = require('fs');
const express = require('express');
const https = require('https');
const socketIo = require('socket.io');

const app = express();

const options = {
    key: fs.readFileSync(__dirname + '/ssl/server.key'),
    cert: fs.readFileSync(__dirname + '/ssl/server.cert')
}

const server = https.createServer(options, app);
const io = socketIo(server, {
    cors: {origin: "*"}
});

io.on('connection', (socket => {
    console.log('Userconnected', socket.id);

    socket.on('chatMessage', (msg => {
        io.emit('chatMessage', {user: socket.id, text: msg, time: new Date()});
    }));

    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
    });
}));

server.listen(443, () => {
    console.log('Server is running on port 443');
});