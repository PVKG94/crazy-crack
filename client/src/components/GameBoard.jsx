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

  const [spectatedPlayerId, setSpectatedPlayerId] = useState(null);
  const [spectatedBoard, setSpectatedBoard] = useState(null);

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

  // Auto-select a spectatable player if we win
  useEffect(() => {
      const me = players.find(p => p.id === myId);
      if (me?.hasWon && !spectatedPlayerId && gameState === 'playing') {
          const remaining = players.filter(p => !p.hasWon && p.id !== myId);
          if (remaining.length > 0) setSpectatedPlayerId(remaining[0].id);
      }
  }, [players, myId, spectatedPlayerId, gameState]);

  // Fetch spectated board when selected
  useEffect(() => {
      const me = players.find(p => p.id === myId);
      if (gameState === 'playing' && me?.hasWon && spectatedPlayerId) {
          socket.emit('get_spectator_board', { roomCode, targetId: spectatedPlayerId }, (res) => {
              if (res.success) {
                  setSpectatedBoard(res.board);
              }
          });
      }
  }, [spectatedPlayerId, gameState, players, myId, roomCode, socket]);

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
        socket.emit('board_ready', { roomCode, board });
    }
  };

  const handleCellClick = (number) => {
    if (gameState !== 'playing') return;
    if (isSpectator) return;
    const me = players.find(p => p.id === myId);
    if (me?.hasWon) return; // Winners cannot play
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
  const me = players.find(p => p.id === myId);
  
  const isWinnerSpectating = me?.hasWon && spectatedBoard;
  const renderBoard = isWinnerSpectating ? spectatedBoard : board;

  const getCompletedLines = (targetBoard) => {
       if (!targetBoard || targetBoard.includes(null)) return [];
       const strikes = [];
       for (let i = 0; i < 10; i++) {
          let r = true, c = true;
          for (let j=0; j<10; j++) {
              if (!calledNumbers.has(targetBoard[i*10+j])) r = false;
              if (!calledNumbers.has(targetBoard[j*10+i])) c = false;
          }
          if (r) strikes.push(`row-${i}`);
          if (c) strikes.push(`col-${i}`);
       }
       let d1 = true, d2 = true;
       for (let i=0; i<10; i++) {
          if (!calledNumbers.has(targetBoard[i*10+i])) d1 = false;
          if (!calledNumbers.has(targetBoard[i*10+(9-i)])) d2 = false;
       }
       if (d1) strikes.push('diag-1');
       if (d2) strikes.push('diag-2');
       return strikes;
  };

  const currentCompletedLines = isWinnerSpectating ? getCompletedLines(spectatedBoard) : completedLinesArr;

  return (
    <div className="game-container">
        <button className="back-btn" onClick={onLeave}>← Back</button>
        <TitleScore linesCompleted={isWinnerSpectating ? currentCompletedLines.length : lines} />

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
                            {p.rank && (
                                <div className={`strip-rank ${p.rank === '1st Place' ? 'first-place' : ''}`}>
                                    {p.rank === '1st Place' ? '👑' : p.rank.split(' ')[0]}
                                </div>
                            )}
                        </div>
                        <span className="strip-name">{p.id === myId ? 'You' : p.username}</span>
                        <span className="strip-lines">{p.id === myId ? lines : (p.linesCompleted || 0)}</span>
                    </div>
                );
            })}
        </div>
        
        <div className="game-header">
            {me?.hasWon ? (
                <div className="spectator-controls">
                    <h3 style={{margin: '0 0 0.5rem 0', color: '#ccc'}}>👁️ Spectating Active Players</h3>
                    <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap'}}>
                         {players.filter(p => !p.hasWon && p.id !== myId).map(p => (
                             <button 
                                key={p.id}
                                className={`secondary-btn ${spectatedPlayerId === p.id ? 'glow' : ''}`}
                                style={{padding: '0.4rem 1rem', fontSize: '0.9rem', borderColor: spectatedPlayerId === p.id ? 'var(--accent-color)' : ''}}
                                onClick={() => setSpectatedPlayerId(p.id)}
                             >
                                {p.username}
                             </button>
                         ))}
                    </div>
                </div>
            ) : (
                <h2 className={isMyTurn ? 'my-turn glow' : ''}>
                    {isSpectator
                      ? `👁️ Spectating — ${currentTurnPlayer?.username || '...'}'s turn`
                      : isMyTurn ? "IT'S YOUR TURN!" : "Waiting for turn..."}
                </h2>
            )}
        </div>

        <div className={`grid-board playing ${isMyTurn ? 'active-turn' : ''} ${isWinnerSpectating ? 'spectating-mode' : ''}`}>
             
             {/* Render Full Line Strikes */}
             {currentCompletedLines.map(lineClass => (
                 <div key={lineClass} className={`board-strike-line ${lineClass} strike-${profile?.animStyle || 'pop'}-line`}></div>
             ))}

             {renderBoard.map((num, i) => {
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
