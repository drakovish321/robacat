const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for games and users
const games = new Map();
const users = new Map();
const gameStates = new Map(); // Store game state for each game

// Cat types with their earnings
const catTypes = [
    { id: 'tabby', name: 'Tabby', color: '#FFD700', earnings: 1 },
    { id: 'persian', name: 'Persian', color: '#FF69B4', earnings: 2 },
    { id: 'siamese', name: 'Siamese', color: '#87CEEB', earnings: 3 },
    { id: 'maine-coon', name: 'Maine Coon', color: '#9370DB', earnings: 5 },
    { id: 'bengal', name: 'Bengal', color: '#FF4500', earnings: 7 }
];

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Signup page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Create new game
app.post('/create-game', (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    // Create unique game ID
    const gameId = Math.random().toString(36).substring(2, 10);
    
    // Create game state
    const game = {
        id: gameId,
        players: [username],
        status: 'waiting',
        createdAt: new Date(),
        cats: [],
        playerPositions: new Map(),
        moneyPerSecond: 0
    };
    
    // Initialize game state
    gameStates.set(gameId, game);
    users.set(username, { gameId, role: 'owner' });
    
    // Create initial cats
    createCats(gameId, 10);
    
    res.json({ 
        gameId, 
        message: 'Game created successfully',
        redirectUrl: `/game-page/${gameId}`
    });
});

// Join existing game
app.post('/join-game', (req, res) => {
    const { username, gameId } = req.body;
    
    if (!username || !gameId) {
        return res.status(400).json({ error: 'Username and Game ID are required' });
    }
    
    const game = gameStates.get(gameId);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.players.length >= 4) {
        return res.status(400).json({ error: 'Game is full' });
    }
    
    game.players.push(username);
    users.set(username, { gameId, role: 'player' });
    
    res.json({ 
        message: 'Joined game successfully',
        redirectUrl: `/game-page/${gameId}`
    });
});

// Get game info
app.get('/game/:gameId', (req, res) => {
    const { gameId } = req.params;
    const game = gameStates.get(gameId);
    
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
});

// Update player position
app.post('/update-position/:gameId', (req, res) => {
    const { gameId } = req.params;
    const { username, x, y } = req.body;
    
    const game = gameStates.get(gameId);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    // Store player position
    game.playerPositions.set(username, { x, y });
    
    res.json({ success: true });
});

// Collect cat
app.post('/collect-cat/:gameId', (req, res) => {
    const { gameId } = req.params;
    const { username, catId } = req.body;
    
    const game = gameStates.get(gameId);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    // Find the cat
    const catIndex = game.cats.findIndex(cat => cat.id === catId);
    if (catIndex === -1) {
        return res.status(404).json({ error: 'Cat not found' });
    }
    
    // Get cat type info
    const catType = catTypes.find(type => type.id === game.cats[catIndex].type);
    if (!catType) {
        return res.status(404).json({ error: 'Cat type not found' });
    }
    
    // Update player money
    const player = game.players.find(p => p === username);
    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }
    
    // Remove cat from game
    game.cats.splice(catIndex, 1);
    
    // Create new cat at random position
    createCat(gameId);
    
    // Update money per second
    game.moneyPerSecond += catType.earnings;
    
    res.json({ 
        success: true,
        money: game.moneyPerSecond,
        moneyPerSecond: game.moneyPerSecond
    });
});

// Create cats for game
function createCats(gameId, count) {
    const game = gameStates.get(gameId);
    if (!game) return;
    
    for (let i = 0; i < count; i++) {
        createCat(gameId);
    }
}

// Create a single cat
function createCat(gameId) {
    const game = gameStates.get(gameId);
    if (!game) return;
    
    const catType = catTypes[Math.floor(Math.random() * catTypes.length)];
    
    const cat = {
        id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
        type: catType.id,
        x: 50 + Math.random() * 700,
        y: 50 + Math.random() * 500
    };
    
    game.cats.push(cat);
}

// Serve lobby page
app.get('/lobby/:gameId', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve game page
app.get('/game-page/:gameId', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
