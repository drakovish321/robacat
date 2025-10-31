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

// Spawn some random cats
for (let i = 0; i < 5; i++) {
    cats.push({ id: i, x: Math.random() * 500, y: Math.random() * 500 });
}

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);
    // Initialize player
    players[socket.id] = { x: 50, y: 50, score: 0 };

    // Send current state
    socket.emit('init', { players, cats });

    // Broadcast new player to others
    socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

    // Handle player movement
    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;

            // Check for cat collection
            cats = cats.filter(cat => {
                if (Math.hypot(cat.x - data.x, cat.y - data.y) < 20) {
                    players[socket.id].score += 1;
                    io.to(socket.id).emit('score', players[socket.id].score);
                    return false; // remove cat
                }
                return true;
            });

            io.emit('update', { players, cats });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('update', { players, cats });
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
