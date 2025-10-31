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

// Spawn random cats on flat world
function spawnCats(n = 8) {
  cats = [];
  for (let i = 0; i < n; i++) {
    cats.push({ id: i, x: Math.random() * 80 - 40, z: Math.random() * 80 - 40 });
  }
}
spawnCats();

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Initialize player
  players[socket.id] = {
    x: Math.random() * 80 - 40,
    z: Math.random() * 80 - 40,
    score: 0
  };

  socket.emit('init', { id: socket.id, players, cats });
  socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

  // Movement handler
  socket.on('move', (data) => {
    const p = players[socket.id];
    if (!p) return;

    p.x = data.x;
    p.z = data.z;

    // Cat collection
    cats = cats.filter(cat => {
      if (Math.hypot(cat.x - p.x, cat.z - p.z) < 1.5) {
        p.score++;
        socket.emit('score', p.score);
        return false;
      }
      return true;
    });

    // Respawn cats if all gone
    if (cats.length === 0) spawnCats();

    io.emit('update', { players, cats });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('update', { players, cats });
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
