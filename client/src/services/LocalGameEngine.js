// src/services/LocalGameEngine.js

function generateRoomCode() {
    return 'LOCAL-' + Math.floor(Math.random() * 1000000);
}

function randomizeBoard() {
    const nums = Array.from({length: 100}, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    return nums;
}

function checkLines(board, calledSet) {
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

// Calculate the maximum progress any line containing the given number has made
function getNumberProgressScore(number, board, calledSet) {
    const idx = board.indexOf(number);
    if (idx === -1) return 0;
    const row = Math.floor(idx / 10);
    const col = idx % 10;
    
    let rowCount = 0, colCount = 0;
    for (let j = 0; j < 10; j++) {
        if (calledSet.has(board[row * 10 + j])) rowCount++;
        if (calledSet.has(board[j * 10 + col])) colCount++;
    }
    
    let diag1Count = 0, diag2Count = 0;
    if (row === col) {
        for (let i = 0; i < 10; i++) {
            if (calledSet.has(board[i * 10 + i])) diag1Count++;
        }
    }
    if (row + col === 9) {
        for (let i = 0; i < 10; i++) {
            if (calledSet.has(board[i * 10 + (9 - i)])) diag2Count++;
        }
    }
    
    return Math.max(rowCount, colCount, diag1Count, diag2Count);
}

export class LocalGameEngine {
    constructor(difficulty = 'medium') {
        this.id = 'socket-local';
        this.connected = true;
        this.listeners = {};
        this.difficulty = difficulty; // 'beginner', 'easy', 'medium', 'hard', 'extreme'
        this.room = null;
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        if (!callback) {
            delete this.listeners[event];
            return;
        }
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    _trigger(event, ...args) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(...args));
        }
    }

    emit(event, data, callback) {
        if (!this.connected) return;

        switch (event) {
            case 'create_single_player': {
                const roomCode = generateRoomCode();
                this.room = {
                    code: roomCode,
                    players: [
                        {
                            id: this.id,
                            username: data.username,
                            avatar: data.avatar,
                            isHost: true,
                            isReady: false,
                            linesCompleted: 0,
                            hasWon: false,
                            isBot: false,
                            board: []
                        },
                        {
                            id: `bot-${Date.now()}`,
                            username: `CPU Bot (${this.difficulty})`,
                            avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=CpuBot",
                            isHost: false,
                            isReady: true,
                            linesCompleted: 0,
                            hasWon: false,
                            isBot: true,
                            board: randomizeBoard()
                        }
                    ],
                    state: 'waiting',
                    turnIndex: 0,
                    calledNumbers: []
                };
                if (callback) callback({ success: true, roomCode });
                break;
            }
            case 'get_room_data': {
                if (!this.room) return callback({ success: false });
                const safePlayers = this.room.players.map(p => ({ ...p, board: undefined }));
                callback({ success: true, players: safePlayers, state: this.room.state });
                break;
            }
            case 'start_game_request': {
                if (this.room) {
                    this.room.state = 'setup';
                    // Send lobby_update first so App.jsx has fresh player data before setup screen
                    this._trigger('lobby_update', this.room.players.map(p => ({...p, board: undefined})));
                    this._trigger('game_started', { state: 'setup' });
                }
                break;
            }
            case 'board_ready': {
                const reqRoomCode = typeof data === 'string' ? data : data.roomCode;
                if (!this.room || this.room.code !== reqRoomCode) {
                    if (callback) callback({ success: false, message: 'Room not found' });
                    return;
                }

                const player = this.room.players[0]; // local player is always index 0
                player.isReady = true;
                if (data.board) player.board = data.board;

                // Confirm receipt to sender
                if (callback) callback({ success: true });

                this._trigger('player_ready_update', this.room.players.map(p => ({...p, board: undefined})));

                const allReady = this.room.players.every(p => p.isReady);
                if (allReady) {
                    this.room.state = 'playing';
                    this.room.turnIndex = 0;
                    this._trigger('all_players_ready', {
                        players: this.room.players.map(p => ({...p, board: undefined})),
                        currentTurnId: this.room.players[this.room.turnIndex].id 
                    });

                    if (this.room.players[this.room.turnIndex].isBot) {
                        setTimeout(() => this.takeBotTurn(), 2000);
                    }
                }
                break;
            }

            case 'call_number': {
                const { roomCode, number } = data;
                if (!this.room || this.room.code !== roomCode || this.room.state !== 'playing') return;
                
                const currentPlayer = this.room.players[this.room.turnIndex];
                if (currentPlayer.id !== this.id) return;

                if (!this.room.calledNumbers.includes(number)) {
                    this.room.calledNumbers.push(number);
                    this._trigger('number_called', { number, caller: currentPlayer.username });
                    this.advanceTurn();
                }
                break;
            }
            case 'update_score': {
                const { roomCode, linesCompleted } = data;
                if (!this.room || this.room.code !== roomCode) return;

                const player = this.room.players[0];
                player.linesCompleted = linesCompleted;
                if (linesCompleted >= 10 && !player.hasWon) {
                    player.hasWon = true;

                    const wonCount = this.room.players.filter(p => p.hasWon).length;
                    let rank = "1st Place";
                    if (wonCount === 2) rank = "2nd Place";
                    
                    player.rank = rank;
                    this._trigger('player_won', { username: player.username, rank });

                    if (wonCount >= this.room.players.length - 1) {
                        this.room.state = 'finished';
                        this._trigger('game_over', this.room.players.map(p=>({...p, board:undefined})));
                    }
                }
                this._trigger('lobby_update', this.room.players.map(p=>({...p, board:undefined})));
                break;
            }
            case 'rematch': {
                if (!this.room) return;
                this.room.state = 'waiting';
                this.room.calledNumbers = [];
                this.room.turnIndex = 0;
                this.room.players.forEach(p => {
                    p.isReady = p.isBot ? true : false;
                    p.linesCompleted = 0;
                    p.hasWon = false;
                    p.rank = null;
                    if (p.isBot) p.board = randomizeBoard();
                });
                this._trigger('rematch_started');
                this._trigger('lobby_update', this.room.players.map(p => ({...p, board: undefined})));
                break;
            }
            case 'send_chat': {
                this._trigger('chat_message', data);
                break;
            }
        }
    }

    advanceTurn() {
        do {
            this.room.turnIndex = (this.room.turnIndex + 1) % this.room.players.length;
        } while (this.room.players[this.room.turnIndex].hasWon === true);

        this._trigger('turn_update', { currentTurnId: this.room.players[this.room.turnIndex].id });

        const currentPlayer = this.room.players[this.room.turnIndex];
        if (currentPlayer.isBot) {
            setTimeout(() => this.takeBotTurn(), 2000);
        }
    }

    takeBotTurn() {
        if (!this.room || this.room.state !== 'playing') return;
        const botPlayer = this.room.players[this.room.turnIndex];
        if (!botPlayer || !botPlayer.isBot) return;

        const uncalled = botPlayer.board.filter(n => !this.room.calledNumbers.includes(n));
        if (uncalled.length === 0) return;

        const calledSet = new Set(this.room.calledNumbers);
        const humanPlayer = this.room.players[0];

        let bestNumbers = [];
        let bestScore = -Infinity;
        let worstNumbers = [];
        let worstScore = Infinity;

        // Score all uncalled numbers on the bot's board
        for (const num of uncalled) {
            const botProgress = getNumberProgressScore(num, botPlayer.board, calledSet);
            const humanProgress = getNumberProgressScore(num, humanPlayer.board, calledSet);

            let score = 0;
            switch(this.difficulty) {
                case 'extreme':
                    score = botProgress - humanProgress * 1.5; // Avoid helping human at all costs
                    break;
                case 'hard':
                    score = botProgress; // Only care about own lines
                    break;
                case 'beginner':
                    score = -botProgress; // Actively sabotage self
                    break;
                default: 
                    score = 0; // Handled below for logic blending
            }

            if (score > bestScore) {
                bestScore = score;
                bestNumbers = [num];
            } else if (score === bestScore) {
                bestNumbers.push(num);
            }

            if (score < worstScore) {
                worstScore = score;
                worstNumbers = [num];
            } else if (score === worstScore) {
                worstNumbers.push(num);
            }
        }

        let chosenNumber = uncalled[0];

        if (this.difficulty === 'extreme' || this.difficulty === 'hard') {
            chosenNumber = bestNumbers[Math.floor(Math.random() * bestNumbers.length)];
        } else if (this.difficulty === 'beginner') {
            chosenNumber = bestNumbers[Math.floor(Math.random() * bestNumbers.length)]; // worst logic score is `bestScore` here since negated
        } else if (this.difficulty === 'medium') {
            // 50% chance to play greedy, 50% random
            if (Math.random() > 0.5) {
                // Play greedy
                let medBestScore = -Infinity;
                let medBestNums = [];
                for (const num of uncalled) {
                    const prog = getNumberProgressScore(num, botPlayer.board, calledSet);
                    if (prog > medBestScore) {
                        medBestScore = prog;
                        medBestNums = [num];
                    } else if (prog === medBestScore) {
                        medBestNums.push(num);
                    }
                }
                chosenNumber = medBestNums[Math.floor(Math.random() * medBestNums.length)];
            } else {
                chosenNumber = uncalled[Math.floor(Math.random() * uncalled.length)];
            }
        } else {
            // Easy
            chosenNumber = uncalled[Math.floor(Math.random() * uncalled.length)];
        }

        this.room.calledNumbers.push(chosenNumber);
        this._trigger('number_called', { number: chosenNumber, caller: botPlayer.username });

        const updatedCalledSet = new Set(this.room.calledNumbers);
        botPlayer.linesCompleted = checkLines(botPlayer.board, updatedCalledSet);

        if (botPlayer.linesCompleted >= 10 && !botPlayer.hasWon) {
            botPlayer.hasWon = true;
            const wonCount = this.room.players.filter(p => p.hasWon).length;
            let rank = "1st Place";
            if (wonCount === 2) rank = "2nd Place";
            
            botPlayer.rank = rank;
            this._trigger('player_won', { username: botPlayer.username, rank });

            if (wonCount >= this.room.players.length - 1) {
                this.room.state = 'finished';
                this._trigger('game_over', this.room.players.map(p => ({...p, board: undefined})));
                return;
            }
        }

        this._trigger('lobby_update', this.room.players.map(p => ({...p, board: undefined})));
        this.advanceTurn();
    }

    connect() {
        this.connected = true;
        this._trigger('connect');
    }

    disconnect() {
        this.connected = false;
        this._trigger('disconnect');
    }
}
