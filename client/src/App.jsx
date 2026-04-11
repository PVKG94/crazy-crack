import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { StatusBar } from '@capacitor/status-bar'
import { LocalGameEngine } from './services/LocalGameEngine'
import './App.css'
import ProfileSetup from './components/ProfileSetup'
import MainMenu from './components/MainMenu'
import Lobby from './components/Lobby'
import ChatSidebar from './components/ChatSidebar'
import { GameBoard } from './components/GameBoard'
import { playSoundEffect } from './utils/audio'
import SettingsModal from './components/SettingsModal'
import ConfirmModal from './components/ConfirmModal'
import Confetti from './components/Confetti'
import HowToPlay from './components/HowToPlay'

// Initialize single socket connection
// In production (same-origin), use '' so socket.io connects to the serving host
const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''
const networkSocket = io(SERVER_URL)

// Stats helpers
function loadStats() {
  try {
    const raw = localStorage.getItem('crazy_crack_stats');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { gamesPlayed: 0, wins: 0, totalLines: 0 };
}
function saveStats(stats) {
  localStorage.setItem('crazy_crack_stats', JSON.stringify(stats));
}

function App() {
  const [socket, setSocket] = useState(networkSocket);
  const [isConnected, setIsConnected] = useState(networkSocket.connected);
  const [profile, setProfile] = useState(null);
  
  // Game session states
  const [room, setRoom] = useState(null); 
  const [gameState, setGameState] = useState('waiting'); // waiting, setup, playing, finished
  const [players, setPlayers] = useState([]);
  const [currentTurnId, setCurrentTurnId] = useState(null);
  const [winnerAnnouncement, setWinnerAnnouncement] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [myFinalLines, setMyFinalLines] = useState(0);

  // Settings & Navigation
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCalledNumbers, setSpectatorCalledNumbers] = useState([]);

  // Hide mobile status bar for true fullscreen game experience
  useEffect(() => {
    const hideUI = async () => {
      try {
        await StatusBar.hide();
      } catch (e) {
        // Will throw quietly on web dev environment, safe to ignore
      }
    };
    hideUI();
  }, []);

  useEffect(() => {
    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }

    function onLobbyUpdate(updatedPlayers) {
        setPlayers(updatedPlayers);
    }

    function onGameStarted(data) {
        setGameState(data.state);
    }

    function onPlayerReadyUpdate(updatedPlayers) {
        setPlayers(updatedPlayers);
    }

    function onAllPlayersReady(data) {
        setPlayers(data.players);
        setCurrentTurnId(data.currentTurnId);
        setGameState('playing');
    }

    function onTurnUpdate(data) {
        setCurrentTurnId(data.currentTurnId);
    }

    function onPlayerWon(data) {
        console.log(`${data.username} took ${data.rank}!`);
        playSoundEffect('win');
        if (data.rank === "1st Place") {
            setWinnerAnnouncement(data);
            setShowConfetti(true);
            setTimeout(() => {
              setWinnerAnnouncement(null);
              setShowConfetti(false);
            }, 5000);
        }
    }

    function onGameOver(finalPlayers) {
        setPlayers(finalPlayers);
        setGameState('finished');
        // Save stats
        const me = finalPlayers.find(p => p.id === socket.id);
        if (me) {
          setMyFinalLines(me.linesCompleted || 0);
          const stats = loadStats();
          stats.gamesPlayed++;
          stats.totalLines += (me.linesCompleted || 0);
          if (me.hasWon) stats.wins++;
          saveStats(stats);
        }
    }

    function onRematchStarted() {
        setGameState('waiting');
        setCurrentTurnId(null);
        setWinnerAnnouncement(null);
        setShowConfetti(false);
        setMyFinalLines(0);
    }

    function onKickedFromRoom() {
        setRoom(null);
        setGameState('waiting');
        setPlayers([]);
        alert('You were removed from the room by the host.');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('lobby_update', onLobbyUpdate);
    socket.on('game_started', onGameStarted);
    socket.on('player_ready_update', onPlayerReadyUpdate);
    socket.on('all_players_ready', onAllPlayersReady);
    socket.on('turn_update', onTurnUpdate);
    socket.on('player_won', onPlayerWon);
    socket.on('game_over', onGameOver);
    socket.on('rematch_started', onRematchStarted);
    socket.on('kicked_from_room', onKickedFromRoom);

    // Handle LocalStorage Profile loading
    const savedName = localStorage.getItem('crazy_crack_username');
    const savedAvatar = localStorage.getItem('crazy_crack_avatar');
    const savedAnim = localStorage.getItem('crazy_crack_anim') || 'pop';
    if (savedName && savedAvatar) {
      setProfile({ username: savedName, avatar: savedAvatar, animStyle: savedAnim });
    }

    // Restore saved theme
    const savedTheme = localStorage.getItem('crazy_crack_theme');
    if (savedTheme && savedTheme !== 'default') {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Restore saved volume
    const savedVol = localStorage.getItem('crazy_crack_volume');
    if (savedVol !== null) {
      window.crazyCrackVolume = parseFloat(savedVol);
    }

    // Check URL for ?room= join link
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setPendingJoinCode(roomParam.toUpperCase());
      // Clean up URL without reload
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('lobby_update', onLobbyUpdate);
      socket.off('game_started', onGameStarted);
      socket.off('player_ready_update', onPlayerReadyUpdate);
      socket.off('all_players_ready', onAllPlayersReady);
      socket.off('turn_update', onTurnUpdate);
      socket.off('player_won', onPlayerWon);
      socket.off('game_over', onGameOver);
      socket.off('rematch_started', onRematchStarted);
      socket.off('kicked_from_room', onKickedFromRoom);
    };
  }, [socket]);

  // Track host status
  useEffect(() => {
    if (players.length > 0) {
      setIsHost(players[0]?.id === socket.id);
    }
  }, [players]);

  // Auto-join from URL ?room= param once profile is ready
  useEffect(() => {
    if (pendingJoinCode && profile && isConnected && !room) {
      handleJoinRoom(pendingJoinCode);
      setPendingJoinCode(null);
    }
  }, [pendingJoinCode, profile, isConnected, room]);

  // Handle transparent socket reconnections (e.g., app wakes from sleep)
  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);

  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  useEffect(() => {
     if (isConnected && roomRef.current && profileRef.current && socket === networkSocket) {
         // Silently re-sync our new generated Socket ID with the backend's room state
         socket.emit('join_room', { roomCode: roomRef.current, profile: profileRef.current }, () => {});
     }
  }, [isConnected, socket]);

  const handleProfileComplete = (newProfile) => {
    setProfile(newProfile);
  };

  const handleUpdateProfile = (updated) => {
    setProfile(updated);
  };

  const requestLeaveRoom = () => {
    if (gameState === 'playing' || gameState === 'setup') {
      setShowLeaveConfirm(true);
    } else {
      leaveRoom();
    }
  };

  const confirmLeaveRoom = () => {
    setShowLeaveConfirm(false);
    leaveRoom();
  };

  const handleCreateRoom = () => {
    socket.emit('create_room', profile, (response) => {
       if (response.success) {
         setRoom(response.roomCode);
         setGameState('waiting');
       }
    });
  };

  const handleJoinRoom = (code) => {
    socket.emit('join_room', { roomCode: code, profile }, (response) => {
       if (response.success) {
         setRoom(code);
         if (response.spectator) {
           // Joining as spectator mid-game
           setIsSpectator(true);
           setGameState(response.gameState);
           setSpectatorCalledNumbers(response.calledNumbers || []);
           if (response.currentTurnId) setCurrentTurnId(response.currentTurnId);
         } else if (response.reconnected) {
           // Reconnecting to existing game
           setGameState(response.gameState);
         } else {
           setGameState('waiting');
         }
       } else {
         alert(response.message);
       }
    });
  };

  const handlePlayBot = (difficulty) => {
    const localSocket = new LocalGameEngine(difficulty);
    setSocket(localSocket);
    
    localSocket.emit('create_single_player', profile, (response) => {
       if (response.success) {
         setRoom(response.roomCode);
         setGameState('waiting');
       }
    });
  };

  const leaveRoom = () => {
      setRoom(null);
      setGameState('waiting');
      setPlayers([]);
      setMyFinalLines(0);
      setIsSpectator(false);
      setSpectatorCalledNumbers([]);
      socket.disconnect(); // force disconnect
      if (socket !== networkSocket) {
        setSocket(networkSocket);
      }
      networkSocket.connect();    // reconnect clean
  };

  const handleRematch = () => {
    socket.emit('rematch', room);
  };

  const handleBackToProfile = () => {
    setProfile(null);
    localStorage.removeItem('crazy_crack_username');
    localStorage.removeItem('crazy_crack_avatar');
    localStorage.removeItem('crazy_crack_anim');
  };

  return (
    <div className="app-container">
      {/* Top-right buttons */}
      <button className="settings-gear-btn" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
      <button className="help-btn" onClick={() => setShowHowToPlay(true)} title="How to Play">?</button>

      {(!room || (gameState !== 'setup' && gameState !== 'playing')) && (
          <h1>C R A Z Y  C R A C K</h1>
      )}
      
      {!profile ? (
        <ProfileSetup onComplete={handleProfileComplete} />
      ) : !room ? (
      <MainMenu 
          profile={profile} 
          onCreateRoom={handleCreateRoom} 
          onJoinRoom={handleJoinRoom}
          onPlayBot={handlePlayBot}
          onBack={handleBackToProfile}
          isConnected={isConnected}
        />
      ) : gameState === 'waiting' ? (
        <Lobby 
            socket={socket} 
            roomCode={room} 
            profile={profile} 
            onLeave={requestLeaveRoom}
        />
      ) : gameState === 'setup' || gameState === 'playing' ? (
        <GameBoard 
            socket={socket}
            roomCode={room}
            gameState={gameState}
            players={players}
            currentTurnId={currentTurnId}
            myId={socket.id}
            profile={profile}
            onLeave={requestLeaveRoom}
            isSpectator={isSpectator}
            spectatorCalledNumbers={spectatorCalledNumbers}
        />
      ) : (
        <div className="finished-screen">
            <h2>Game Over!</h2>
            <div className="leaderboard">
              {[...players]
                .sort((a, b) => (b.linesCompleted || 0) - (a.linesCompleted || 0))
                .map((p, idx) => {
                  const medal = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                  const isImg = p.avatar && (p.avatar.startsWith('data:') || p.avatar.startsWith('http'));
                  const isMe = p.id === socket.id;
                  return (
                    <div key={p.id} className={`lb-row ${idx === 0 ? 'lb-first' : ''} ${isMe ? 'lb-me' : ''}`}>
                      <span className="lb-rank">{medal}</span>
                      <div className="lb-avatar-wrap">
                        {isImg ? (
                          <img src={p.avatar} alt={p.username} className="lb-avatar" />
                        ) : (
                          <div className="lb-avatar text-avatar">{p.avatar || p.username?.charAt(0)}</div>
                        )}
                      </div>
                      <span className="lb-name">{isMe ? `${p.username} (You)` : p.username}</span>
                      <div className="lb-score-bar">
                        <div className="lb-score-fill" style={{ width: `${Math.min(((p.linesCompleted || 0) / 10) * 100, 100)}%` }}></div>
                        <span className="lb-score-text">{p.linesCompleted || 0}/10</span>
                      </div>
                      {p.hasWon && <span className="lb-crown">👑</span>}
                    </div>
                  );
                })}
            </div>
            <div className="finished-actions">
              {isHost && (
                <button className="primary-btn" onClick={handleRematch}>🔄 Play Again</button>
              )}
              <button className={`secondary-btn ${isHost ? '' : 'full-width'}`} onClick={leaveRoom}>Back to Menu</button>
            </div>
        </div>
      )}

      {(!room || gameState === 'waiting') && (
         <div className="server-status-container">
            {isConnected ? (
              <p className="status online">🟢 Server Online</p>
            ) : (
              <div className="status booting">
                <div className="spinner"></div>
                <p>Waking Multiplayer Server... (this may take up to 50s)</p>
              </div>
            )}
         </div>
      )}

      {winnerAnnouncement && (
          <div className="massive-winner-overlay">
              <div className="winner-content">
                  <h1 className="winner-rank">{winnerAnnouncement.rank}</h1>
                  <h2 className="winner-name">{winnerAnnouncement.username} wins!</h2>
              </div>
          </div>
      )}

      {/* Confetti on win */}
      <Confetti active={showConfetti} duration={5000} />

      {/* Text Chat */}
      {room && (
        <ChatSidebar socket={socket} roomCode={room} profile={profile} />
      )}

      {/* Modals */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentProfile={profile}
        onUpdateProfile={handleUpdateProfile}
      />

      <ConfirmModal
        isOpen={showLeaveConfirm}
        title="Leave Game?"
        message="Your current progress will be lost. Are you sure you want to leave?"
        onConfirm={confirmLeaveRoom}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      <HowToPlay
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

    </div>
  )
}

export default App
