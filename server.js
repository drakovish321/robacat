// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state variables
let players = {};
let brainrots = [];
let powerups = [];
let bullets = [];
let gameActive = false;
let gameTime = 0;
let gameStartTime = 0;

// Game configuration
const GAME_CONFIG = {
    MAX_PLAYERS: 10,
    BRAINROT_COUNT: 10,
    POWERUP_COUNT: 5,
    GAME_DURATION: 300000, // 5 minutes in milliseconds
    SPAWN_INTERVAL: 2000, // 2 seconds between brainrot spawns
    POWERUP_SPAWN_TIME: 5000 // 5 seconds between powerup spawns
};

// Initialize game objects
function initializeGame() {
    players = {};
    brainrots = [];
    powerups = [];
    bullets = [];
    gameActive = true;
    gameTime = 0;
    gameStartTime = Date.now();
    
    // Create initial brainrots
    for (let i = 0; i < GAME_CONFIG.BRAINROT_COUNT; i++) {
        spawnBrainrot();
    }
    
    // Create initial powerups
    for (let i = 0; i < GAME_CONFIG.POWERUP_COUNT; i++) {
        spawnPowerup();
    }
}

// Spawn a brainrot at random location
function spawnBrainrot() {
    const brainrot = {
        id: Date.now() + Math.random(),
        x: Math.random() * 800 + 100,
        y: Math.random() * 600 + 100,
        z: 0,
        collected: false,
        owner: null
    };
    brainrots.push(brainrot);
}

// Spawn a powerup at random location
function spawnPowerup() {
    const types = ['speed', 'shield', 'invincible', 'health'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const powerup = {
        id: Date.now() + Math.random(),
        x: Math.random() * 800 + 100,
        y: Math.random() * 600 + 100,
        z: 0,
        type: type
    };
    powerups.push(powerup);
}

// Remove a brainrot by ID
function removeBrainrot(id) {
    const index = brainrots.findIndex(b => b.id === id);
    if (index !== -1) {
        brainrots.splice(index, 1);
        return true;
    }
    return false;
}

// Remove a powerup by ID
function removePowerup(id) {
    const index = powerups.findIndex(p => p.id === id);
    if (index !== -1) {
        powerups.splice(index, 1);
        return true;
    }
    return false;
}

// Remove a bullet by ID
function removeBullet(id) {
    const index = bullets.findIndex(b => b.id === id);
    if (index !== -1) {
        bullets.splice(index, 1);
        return true;
    }
    return false;
}

// Get player by ID
function getPlayerById(id) {
    return players[id];
}

// Get all players
function getAllPlayers() {
    return Object.values(players);
}

// Get player count
function getPlayerCount() {
    return Object.keys(players).length;
}

// Socket connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Handle player joining
    socket.on('joinGame', (data) => {
        if (getPlayerCount() >= GAME_CONFIG.MAX_PLAYERS) {
            socket.emit('gameFull');
            return;
        }
        
        // Create new player
        const player = {
            id: socket.id,
            name: data.name || 'Anonymous',
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100,
            z: 0,
            health: 100,
            maxHealth: 100,
            score: 0,
            kills: 0,
            deaths: 0,
            streak: 0,
            ammo: 30,
            maxAmmo: 30,
            rotation: 0,
            isAlive: true,
            powerup: null,
            powerupTime: 0,
            invincible: false,
            shield: false,
            speedBoost: false,
            crouching: false
        };
        
        players[socket.id] = player;
        
        // Send game state to new player
        socket.emit('gameState', {
            players: getAllPlayers(),
            brainrots: brainrots,
            powerups: powerups,
            gameActive: gameActive,
            gameTime: gameTime
        });
        
        // Notify other players about new player
        socket.broadcast.emit('playerJoined', player);
        
        // Start game if enough players
        if (getPlayerCount() >= 2 && !gameActive) {
            initializeGame();
            io.emit('gameStarted');
        }
    });
    
    // Handle player movement
    socket.on('playerMove', (data) => {
        const player = getPlayerById(socket.id);
        if (player && player.isAlive) {
            player.x = data.x;
            player.y = data.y;
            player.z = data.z;
            player.rotation = data.rotation;
            player.crouching = data.crouching;
        }
    });
    
    // Handle shooting
    socket.on('shoot', (data) => {
        const player = getPlayerById(socket.id);
        if (player && player.isAlive && player.ammo > 0) {
            player.ammo--;
            
            // Create bullet
            const bullet = {
                id: Date.now() + Math.random(),
                x: player.x + Math.cos(player.rotation) * 15,
                y: player.y + Math.sin(player.rotation) * 15,
                z: player.z,
                rotation: player.rotation,
                playerId: socket.id,
                damage: 25
            };
            
            bullets.push(bullet);
            
            // Broadcast bullet to all players
            io.emit('bulletFired', bullet);
        }
    });
    
    // Handle player taking damage
    socket.on('playerHit', (data) => {
        const player = getPlayerById(data.playerId);
        if (player && player.isAlive) {
            player.health -= data.damage;
            
            if (player.health <= 0) {
                player.health = 0;
                player.isAlive = false;
                player.deaths++;
                
                // Find killer
                const killer = getPlayerById(data.killerId);
                if (killer && killer.id !== player.id) {
                    killer.kills++;
                    killer.streak++;
                    killer.score += 10;
                    
                    // Bonus for streak
                    if (killer.streak >= 3) {
                        killer.score += 50;
                    }
                }
                
                // Broadcast death event
                io.emit('playerDied', {
                    playerId: player.id,
                    killerId: data.killerId
                });
            }
        }
    });
    
    // Handle brainrot collection
    socket.on('collectBrainrot', (data) => {
        const player = getPlayerById(socket.id);
        if (player && player.isAlive) {
            const brainrotIndex = brainrots.findIndex(b => b.id === data.brainrotId);
            if (brainrotIndex !== -1) {
                // Mark brainrot as collected
                brainrots[brainrotIndex].collected = true;
                brainrots[brainrotIndex].owner = socket.id;
                
                // Increase player score
                player.score += 50;
                
                // Broadcast collection event
                io.emit('brainrotCollected', {
                    brainrotId: data.brainrotId,
                    playerId: socket.id
                });
                
                // Spawn new brainrot after delay
                setTimeout(() => {
                    spawnBrainrot();
                    io.emit('newBrainrotSpawned', brainrots[brainrots.length - 1]);
                }, GAME_CONFIG.SPAWN_INTERVAL);
            }
        }
    });
    
    // Handle powerup collection
    socket.on('collectPowerup', (data) => {
        const player = getPlayerById(socket.id);
        if (player && player.isAlive) {
            const powerupIndex = powerups.findIndex(p => p.id === data.powerupId);
            if (powerupIndex !== -1) {
                const powerup = powerups[powerupIndex];
                
                // Apply powerup effect
                switch (powerup.type) {
                    case 'speed':
                        player.speedBoost = true;
                        player.powerup = 'speed';
                        player.powerupTime = 10000;
                        break;
                    case 'shield':
                        player.shield = true;
                        player.powerup = 'shield';
                        player.powerupTime = 10000;
                        break;
                    case 'invincible':
                        player.invincible = true;
                        player.powerup = 'invincible';
                        player.powerupTime = 10000;
                        break;
                    case 'health':
                        player.health = Math.min(player.maxHealth, player.health + 50);
                        break;
                }
                
                // Remove powerup
                powerups.splice(powerupIndex, 1);
                
                // Broadcast powerup collection
                io.emit('powerupCollected', {
                    powerupId: data.powerupId,
                    playerId: socket.id,
                    type: powerup.type
                });
                
                // Spawn new powerup after delay
                setTimeout(() => {
                    spawnPowerup();
                    io.emit('newPowerupSpawned', powerups[powerups.length - 1]);
                }, GAME_CONFIG.POWERUP_SPAWN_TIME);
            }
        }
    });
    
    // Handle player reload
    socket.on('reload', () => {
        const player = getPlayerById(socket.id);
        if (player && player.isAlive) {
            player.ammo = player.maxAmmo;
        }
    });
    
    // Handle chat message
    socket.on('chatMessage', (data) => {
        const player = getPlayerById(socket.id);
        if (player) {
            io.emit('chatMessage', {
                name: player.name,
                text: data.text,
                time: new Date()
            });
        }
    });
    
    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        // Remove player from game
        delete players[socket.id];
        
        // Notify others
        socket.broadcast.emit('playerLeft', socket.id);
        
        // If no players left, reset game
        if (getPlayerCount() === 0) {
            gameActive = false;
        }
    });
});

// Game loop
setInterval(() => {
    if (!gameActive) return;
    
    // Update game time
    gameTime = Date.now() - gameStartTime;
    
    // Update powerup timers
    Object.values(players).forEach(player => {
        if (player.powerupTime > 0) {
            player.powerupTime -= 100;
            if (player.powerupTime <= 0) {
                player.powerup = null;
                player.speedBoost = false;
                player.invincible = false;
                player.shield = false;
            }
        }
    });
    
    // Broadcast game state to all players
    io.emit('gameUpdate', {
        players: getAllPlayers(),
        brainrots: brainrots,
        powerups: powerups,
        gameTime: gameTime
    });
}, 100);

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server with timeout handling
const PORT = process.env.PORT || 3000;
const serverInstance = server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Add timeout for server startup
setTimeout(() => {
    if (!serverInstance.listening) {
        console.error("Server failed to start within 20 seconds");
        process.exit(1);
    }
}, 20000);

// Handle server errors
serverInstance.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
