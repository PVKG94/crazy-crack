const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve the built React client in production
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Store rooms in memory
const rooms = {};

function generateRoomCode() {
    let result = '';
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ( let i = 0; i < 4; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function randomizeBoard() {
    const nums = Array.from({length: 100}, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    return nums;
}

function checkBotLines(board, calledSet) {
    let linesCount = 0;
    // Rows & Cols
    for (let i = 0; i < 10; i++) {
        let rowMatch = true, colMatch = true;
        for (let j = 0; j < 10; j++) {
            if (!calledSet.has(board[i * 10 + j])) rowMatch = false;
            if (!calledSet.has(board[j * 10 + i])) colMatch = false;
        }
        if (rowMatch) linesCount++;
        if (colMatch) linesCount++;
    }
    // Diagonals
    let diag1Match = true, diag2Match = true;
    for (let i = 0; i < 10; i++) {
        if (!calledSet.has(board[i * 10 + i])) diag1Match = false;
        if (!calledSet.has(board[i * 10 + (9 - i)])) diag2Match = false;
    }
    if (diag1Match) linesCount++;
    if (diag2Match) linesCount++;
    
    return linesCount;
}

function advanceTurn(room) {
    do {
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
    } while (room.players[room.turnIndex].hasWon === true);
    
    io.to(room.code).emit('turn_update', { currentTurnId: room.players[room.turnIndex].id });

    // If it's a bot's turn, schedule their move
    const currentPlayer = room.players[room.turnIndex];
    if (currentPlayer.isBot) {
        setTimeout(() => takeBotTurn(room.code, currentPlayer), 2000);
    }
}

function takeBotTurn(roomCode, botPlayer) {
    const room = rooms[roomCode];
    if (!room || room.state !== 'playing') return;
    if (room.players[room.turnIndex].id !== botPlayer.id) return;

    const uncalled = botPlayer.board.filter(n => !room.calledNumbers.includes(n));
    if (uncalled.length === 0) return;

    // Bot picks random uncalled number
    const chosenNumber = uncalled[Math.floor(Math.random() * uncalled.length)];
    room.calledNumbers.push(chosenNumber);

    io.to(roomCode).emit('number_called', { number: chosenNumber, caller: botPlayer.username });

    // Check Bot Score
    const calledSet = new Set(room.calledNumbers);
    botPlayer.linesCompleted = checkBotLines(botPlayer.board, calledSet);
    
    if (botPlayer.linesCompleted >= 10 && !botPlayer.hasWon) {
        botPlayer.hasWon = true;
        const wonCount = room.players.filter(p => p.hasWon).length;
        let rank = "1st Place";
        if (wonCount === 2) rank = "2nd Place";
        else if (wonCount === 3) rank = "3rd Place";
        
        io.to(roomCode).emit('player_won', { username: botPlayer.username, rank });
        if (wonCount >= room.players.length - 1) {
            room.state = 'finished';
            io.to(roomCode).emit('game_over', room.players);
            return;
        }
    }
    
    io.to(roomCode).emit('lobby_update', room.players);
    advanceTurn(room);
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('create_room', (profile, callback) => {
        let roomCode;
        do { roomCode = generateRoomCode(); } while (rooms[roomCode]);

        rooms[roomCode] = {
            code: roomCode,
            players: [{
                id: socket.id,
                username: profile.username,
                avatar: profile.avatar,
                isHost: true,
                isReady: false,
                linesCompleted: 0,
                hasWon: false,
                isBot: false
            }],
            state: 'waiting',
            turnIndex: 0,
            calledNumbers: []
        };
        socket.join(roomCode);
        callback({ success: true, roomCode });
    });

    socket.on('create_single_player', (profile, callback) => {
        let roomCode;
        do { roomCode = generateRoomCode(); } while (rooms[roomCode]);

        rooms[roomCode] = {
            code: roomCode,
            players: [
                {
                    id: socket.id,
                    username: profile.username,
                    avatar: profile.avatar,
                    isHost: true,
                    isReady: false,
                    linesCompleted: 0,
                    hasWon: false,
                    isBot: false
                },
                {
                    id: `bot-${Date.now()}`,
                    username: "CPU Bot",
                    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=CpuBot",
                    isHost: false,
                    isReady: true, // Bots are always ready to start
                    linesCompleted: 0,
                    hasWon: false,
                    isBot: true,
                    board: randomizeBoard() // Pre-generate bot's board
                }
            ],
            state: 'waiting',
            turnIndex: 0,
            calledNumbers: []
        };
        socket.join(roomCode);
        callback({ success: true, roomCode });
    });

    socket.on('join_room', (data, callback) => {
        const { roomCode, profile } = data;
        const room = rooms[roomCode];
        
        if (!room) return callback({ success: false, message: 'Room not found.' });

        // Check if this is a reconnecting player (same username, disconnected)
        const existingPlayer = room.players.find(p => p.username === profile.username && p.disconnected);
        if (existingPlayer) {
            existingPlayer.id = socket.id;
            existingPlayer.disconnected = false;
            existingPlayer.avatar = profile.avatar;
            socket.join(roomCode);
            io.to(roomCode).emit('lobby_update', room.players.map(p => ({...p, board: undefined})));
            return callback({ success: true, roomCode, reconnected: true, gameState: room.state });
        }

        // Spectator: allow joining a game in progress as viewer
        if (room.state !== 'waiting') {
            const spectator = {
                id: socket.id,
                username: profile.username,
                avatar: profile.avatar,
                isHost: false,
                isReady: true,
                linesCompleted: 0,
                hasWon: false,
                isBot: false,
                isSpectator: true
            };
            room.players.push(spectator);
            socket.join(roomCode);
            io.to(roomCode).emit('lobby_update', room.players.map(p => ({...p, board: undefined})));
            return callback({
                success: true,
                roomCode,
                spectator: true,
                gameState: room.state,
                calledNumbers: room.calledNumbers,
                currentTurnId: room.players[room.turnIndex]?.id
            });
        }

        if (room.players.length >= 20) return callback({ success: false, message: 'Room is full.' });

        room.players.push({
            id: socket.id,
            username: profile.username,
            avatar: profile.avatar,
            isHost: false,
            isReady: false,
            linesCompleted: 0,
            hasWon: false,
            isBot: false
        });

        socket.join(roomCode);
        io.to(roomCode).emit('lobby_update', room.players);
        callback({ success: true, roomCode });
    });

    socket.on('get_room_data', (roomCode, callback) => {
        if (!rooms[roomCode]) return callback({ success: false });
        // Strip out bot boards so human players don't cheat by reading the socket payload
        const safePlayers = rooms[roomCode].players.map(p => ({ ...p, board: undefined }));
        callback({ success: true, players: safePlayers, state: rooms[roomCode].state });
    });

    socket.on('get_spectator_board', (data, callback) => {
        const { roomCode, targetId } = data;
        const room = rooms[roomCode];
        if (!room) return callback({ success: false });

        const me = room.players.find(p => p.id === socket.id);
        // Security check: only users who have ALREADY WON can request private boards
        if (!me || (!me.hasWon && !me.isSpectator)) return callback({ success: false, message: 'Not authorized' });

        const target = room.players.find(p => p.id === targetId);
        if (!target) return callback({ success: false, message: 'Player not found' });

        callback({ success: true, board: target.board });
    });

    socket.on('start_game_request', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.players[0].id === socket.id) {
            room.state = 'setup';
            io.to(roomCode).emit('game_started', { state: 'setup' });
        }
    });

    socket.on('board_ready', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.isReady = true;
            io.to(roomCode).emit('player_ready_update', room.players.map(p => ({...p, board: undefined})));

            const allReady = room.players.every(p => p.isReady);
            if (allReady) {
                room.state = 'playing';
                room.turnIndex = 0;
                io.to(roomCode).emit('all_players_ready', { 
                    players: room.players.map(p => ({...p, board: undefined})),
                    currentTurnId: room.players[room.turnIndex].id 
                });
                
                // If the very first turn is assigned to a Bot, kick it off
                if (room.players[room.turnIndex].isBot) {
                    setTimeout(() => takeBotTurn(room.code, room.players[room.turnIndex]), 2000);
                }
            }
        }
    });

    socket.on('call_number', (data) => {
        const { roomCode, number } = data;
        const room = rooms[roomCode];
        if (!room || room.state !== 'playing') return;

        const currentPlayer = room.players[room.turnIndex];
        if (currentPlayer.id !== socket.id) return;

        if (!room.calledNumbers.includes(number)) {
            room.calledNumbers.push(number);
            io.to(roomCode).emit('number_called', { number, caller: currentPlayer.username });
            advanceTurn(room);
        }
    });

    socket.on('update_score', (data) => {
        const { roomCode, linesCompleted } = data;
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.linesCompleted = linesCompleted;
            if (linesCompleted >= 10 && !player.hasWon) {
                player.hasWon = true;

                const wonCount = room.players.filter(p => p.hasWon).length;
                let rank = "1st Place";
                if(wonCount === 2) rank = "2nd Place";
                else if(wonCount === 3) rank = "3rd Place";
                else if (wonCount > 3) rank = `${wonCount}th Place`;

                io.to(roomCode).emit('player_won', { username: player.username, rank });

                if (wonCount >= room.players.length - 1) {
                    room.state = 'finished';
                    io.to(roomCode).emit('game_over', room.players.map(p=>({...p, board:undefined})));
                }
            }
            io.to(roomCode).emit('lobby_update', room.players.map(p=>({...p, board:undefined})));
        }
    });

    socket.on('send_chat', (data) => {
        io.to(data.roomCode).emit('chat_message', data);
    });

    socket.on('rematch', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;
        // Only host can trigger rematch
        if (room.players[0]?.id !== socket.id) return;

        // Reset room state
        room.state = 'waiting';
        room.calledNumbers = [];
        room.turnIndex = 0;
        room.players.forEach(p => {
            p.isReady = p.isBot ? true : false;
            p.linesCompleted = 0;
            p.hasWon = false;
            if (p.isBot) p.board = randomizeBoard();
        });

        io.to(roomCode).emit('rematch_started');
        io.to(roomCode).emit('lobby_update', room.players.map(p => ({...p, board: undefined})));
    });

    socket.on('kick_player', (data) => {
        const { roomCode, playerId } = data;
        const room = rooms[roomCode];
        if (!room) return;
        // Only host can kick
        if (room.players[0]?.id !== socket.id) return;
        // Can't kick yourself
        if (playerId === socket.id) return;
        // Only kick during lobby
        if (room.state !== 'waiting') return;

        const idx = room.players.findIndex(p => p.id === playerId);
        if (idx !== -1) {
            const kicked = room.players.splice(idx, 1)[0];
            // Notify the kicked player
            io.to(playerId).emit('kicked_from_room');
            // Make the kicked socket leave the room
            const kickedSocket = io.sockets.sockets.get(playerId);
            if (kickedSocket) kickedSocket.leave(roomCode);
            // Update remaining players
            io.to(roomCode).emit('lobby_update', room.players.map(p => ({...p, board: undefined})));
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const [roomCode, room] of Object.entries(rooms)) {
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index === -1) continue;

            const player = room.players[index];

            // If game is in progress, mark as disconnected (allow reconnect)
            if (room.state === 'playing' || room.state === 'setup') {
                player.disconnected = true;
                io.to(roomCode).emit('lobby_update', room.players.map(p => ({...p, board: undefined})));

                // Skip their turn if it's their turn
                if (room.state === 'playing' && room.players[room.turnIndex]?.id === socket.id) {
                    advanceTurn(room);
                }

                // Auto-remove after 60s if still disconnected
                setTimeout(() => {
                    if (rooms[roomCode] && player.disconnected) {
                        room.players.splice(room.players.indexOf(player), 1);
                        const humanPlayers = room.players.filter(p => !p.isBot);
                        if (humanPlayers.length === 0) {
                            delete rooms[roomCode];
                        } else {
                            if (room.turnIndex >= room.players.length) room.turnIndex = 0;
                            io.to(roomCode).emit('lobby_update', room.players.map(p => ({...p, board: undefined})));
                        }
                    }
                }, 60000);
            } else {
                // In lobby or finished, just remove
                room.players.splice(index, 1);
                const humanPlayers = room.players.filter(p => !p.isBot);
                if (humanPlayers.length === 0) {
                    delete rooms[roomCode];
                } else {
                    if (room.turnIndex >= room.players.length) room.turnIndex = 0;
                    io.to(roomCode).emit('lobby_update', room.players.map(p => ({...p, board: undefined})));
                    
                    if (room.state === 'playing') {
                         io.to(roomCode).emit('turn_update', { currentTurnId: room.players[room.turnIndex].id });
                         if (room.players[room.turnIndex].isBot) {
                            setTimeout(() => takeBotTurn(roomCode, room.players[room.turnIndex]), 2000);
                         }
                    }
                }
            }
        }
    });
});

// Catch-all: serve React app for any non-API route (SPA support)
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`CRAZY CRACK server running on port ${PORT}`);
});
