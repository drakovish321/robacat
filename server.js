const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Game state
let players = {};
let cats = [];

// Spawn 10 random cats on a flat plane
for (let i = 0; i < 10; i++) {
    cats.push({ id: i, x: Math.random() * 50 - 25, z: Math.random() * 50 - 25 });
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Initialize player
    players[socket.id] = { x: Math.random() * 50 - 25, z: Math.random() * 50 - 25, score: 0 };

    // Send initial state
    socket.emit('init', { players, cats, id: socket.id });

    // Notify others
    socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

    // Handle movement
    socket.on('move', (data) => {
        if (!players[socket.id]) return;
        players[socket.id].x = data.x;
        players[socket.id].z = data.z;

        // Check for cat collection (distance < 1.5 units)
        cats = cats.filter(cat => {
            if (Math.hypot(cat.x - data.x, cat.z - data.z) < 1.5) {
                players[socket.id].score += 1;
                socket.emit('score', players[socket.id].score);
                return false;
            }
            return true;
        });

        io.emit('update', { players, cats });
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('update', { players, cats });
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
