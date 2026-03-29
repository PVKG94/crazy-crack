import { useState, useEffect } from 'react';
import './GameBoard.css';
import TitleScore from './TitleScore';
import { playSoundEffect } from '../utils/audio';

export function GameBoard({ socket, roomCode, gameState, players, currentTurnId, myId, profile, onLeave, isSpectator, spectatorCalledNumbers }) {
  const [board, setBoard] = useState(Array(100).fill(null));
  const [calledNumbers, setCalledNumbers] = useState(() => {
    return spectatorCalledNumbers ? new Set(spectatorCalledNumbers) : new Set();
  });
  const [lines, setLines] = useState(0);
  const [completedLinesArr, setCompletedLinesArr] = useState([]);
  const [lastCalledNumber, setLastCalledNumber] = useState(null);

  useEffect(() => {
    socket.on('number_called', (data) => {
      playSoundEffect(profile?.animStyle || 'pop');
      setCalledNumbers(prev => {
        const newSet = new Set(prev);
        newSet.add(data.number);
        return newSet;
      });
      // Flash highlight
      setLastCalledNumber(data.number);
      setTimeout(() => setLastCalledNumber(null), 1200);
    });

    return () => {
      socket.off('number_called');
    };
  }, [socket, profile]);

  // Check lines whenever calledNumbers or board changes
  useEffect(() => {
    if (board.includes(null)) return; // Setup not done

    let linesCount = 0;
    const newCompletedLines = [];
    
    // Check rows & columns
    for (let i = 0; i < 10; i++) {
        let rowMatch = true;
        let colMatch = true;
        
        for (let j = 0; j < 10; j++) {
            if (!calledNumbers.has(board[i * 10 + j])) rowMatch = false;
            if (!calledNumbers.has(board[j * 10 + i])) colMatch = false;
        }
        
        if (rowMatch) { linesCount++; newCompletedLines.push(`row-${i}`); }
        if (colMatch) { linesCount++; newCompletedLines.push(`col-${i}`); }
    }

    // Check Diagonals
    let diag1Match = true;
    let diag2Match = true;
    for (let i = 0; i < 10; i++) {
        if (!calledNumbers.has(board[i * 10 + i])) diag1Match = false;
        if (!calledNumbers.has(board[i * 10 + (9 - i)])) diag2Match = false;
    }
    
    if (diag1Match) { linesCount++; newCompletedLines.push('diag-1'); }
    if (diag2Match) { linesCount++; newCompletedLines.push('diag-2'); }

    if (newCompletedLines.length !== completedLinesArr.length) {
        setCompletedLinesArr(newCompletedLines);
    }

    if (linesCount !== lines) {
        setLines(linesCount);
        socket.emit('update_score', { roomCode, linesCompleted: linesCount });
    }
  }, [board, calledNumbers, lines, completedLinesArr.length, roomCode, socket]);

  const handleRandomize = () => {
    const nums = Array.from({length: 100}, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    setBoard(nums);
  };

  const handleReady = () => {
    if (!board.includes(null)) {
        socket.emit('board_ready', roomCode);
    }
  };

  const handleCellClick = (number) => {
    if (gameState !== 'playing') return;
    if (isSpectator) return;
    if (currentTurnId !== myId) return; // Not my turn
    if (calledNumbers.has(number)) return; // Already called
    
    socket.emit('call_number', { roomCode, number });
  };

  // Spectators skip setup
  if (isSpectator && gameState === 'setup') {
    return <div className="setup-container"><h3>⏳ Waiting for players to set up their boards...</h3></div>;
  }

  // Setup Phase Render
  if (gameState === 'setup') {
    const myPlayer = players.find(p => p.id === myId);
    if (myPlayer?.isReady) {
        return <div className="setup-container"><h3>Waiting for others to finish...</h3></div>;
    }

    return (
        <div className="setup-container">
            <button className="back-btn" onClick={onLeave}>← Back</button>
            <h3>Place your numbers</h3>
            <div className="setup-actions">
                <button className="secondary-btn" onClick={handleRandomize}>Randomize Grid</button>
            </div>
            
            <div className={`grid-board ${!board.includes(null) ? 'ready' : ''}`}>
                {board.map((num, i) => (
                    <div key={i} className="grid-cell empty">{num}</div>
                ))}
            </div>

            <button 
                className="primary-btn ready-btn" 
                disabled={board.includes(null)}
                onClick={handleReady}
            >
                Start Game!
            </button>
        </div>
    );
  }

  // Playing Phase Render
  const isMyTurn = !isSpectator && currentTurnId === myId;
  const currentTurnPlayer = players.find(p => p.id === currentTurnId);

  return (
    <div className="game-container">
        <button className="back-btn" onClick={onLeave}>← Back</button>
        <TitleScore linesCompleted={lines} />

        {/* Player Profiles Strip */}
        <div className="players-strip">
            {players.map(p => {
                const isImg = p.avatar && (p.avatar.startsWith('data:') || p.avatar.startsWith('http'));
                const isCurrentTurn = currentTurnId === p.id;
                return (
                    <div key={p.id} className={`strip-player ${isCurrentTurn ? 'current-turn' : ''}`}>
                        <div className="strip-avatar-wrap">
                            {isImg ? (
                                <img src={p.avatar} alt={p.username} className="strip-avatar" />
                            ) : (
                                <div className="strip-avatar text-avatar">{p.avatar || p.username?.charAt(0)}</div>
                            )}
                        </div>
                        <span className="strip-name">{p.id === myId ? 'You' : p.username}</span>
                        <span className="strip-lines">{p.id === myId ? lines : (p.linesCompleted || 0)}</span>
                    </div>
                );
            })}
        </div>
        
        <div className="game-header">
            <h2 className={isMyTurn ? 'my-turn glow' : ''}>
                {isSpectator
                  ? `👁️ Spectating — ${currentTurnPlayer?.username || '...'}'s turn`
                  : isMyTurn ? "IT'S YOUR TURN!" : "Waiting for turn..."}
            </h2>
        </div>

        <div className={`grid-board playing ${isMyTurn ? 'active-turn' : ''}`}>
             
             {/* Render Full Line Strikes */}
             {completedLinesArr.map(lineClass => (
                 <div key={lineClass} className={`board-strike-line ${lineClass} strike-${profile?.animStyle || 'pop'}-line`}></div>
             ))}

             {board.map((num, i) => {
                 const isCalled = calledNumbers.has(num);
                 const isFlashing = num === lastCalledNumber;
                 return (
                     <div 
                         key={i} 
                         className={`grid-cell ${isCalled ? 'called' : ''} ${isMyTurn && !isCalled ? 'clickable' : ''} ${isFlashing ? 'just-called' : ''}`}
                         onClick={() => handleCellClick(num)}
                     >
                         {num}
                         {isCalled && <div className={`strike-cross strike-${profile?.animStyle || 'pop'}`}></div>}
                     </div>
                 )
             })}
        </div>
    </div>
  );
}
