import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import ProfileSetup from './components/ProfileSetup'
import MainMenu from './components/MainMenu'
import Lobby from './components/Lobby'
import ChatSidebar from './components/ChatSidebar'
import { GameBoard } from './components/GameBoard'
import { playSoundEffect } from './utils/audio'
import SettingsModal from './components/SettingsModal'
import ConfirmModal from './components/ConfirmModal'

// Initialize single socket connection
// In production (same-origin), use '' so socket.io connects to the serving host
const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''
const socket = io(SERVER_URL)

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [profile, setProfile] = useState(null);
  
  // Game session states
  const [room, setRoom] = useState(null); 
  const [gameState, setGameState] = useState('waiting'); // waiting, setup, playing, finished
  const [players, setPlayers] = useState([]);
  const [currentTurnId, setCurrentTurnId] = useState(null);
  const [winnerAnnouncement, setWinnerAnnouncement] = useState(null);

  // Settings & Navigation
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

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
        setWinnerAnnouncement(data);
        setTimeout(() => setWinnerAnnouncement(null), 5000);
    }

    function onGameOver(finalPlayers) {
        setPlayers(finalPlayers);
        setGameState('finished');
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
    };
  }, []);

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
         setGameState('waiting');
       } else {
         alert(response.message);
       }
    });
  };

  const handlePlayBot = () => {
    socket.emit('create_single_player', profile, (response) => {
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
      socket.disconnect(); // force disconnect
      socket.connect();    // reconnect clean
  };

  const handleBackToProfile = () => {
    setProfile(null);
    localStorage.removeItem('crazy_crack_username');
    localStorage.removeItem('crazy_crack_avatar');
    localStorage.removeItem('crazy_crack_anim');
  };

  return (
    <div className="app-container">
      {/* Settings Gear — always visible */}
      <button className="settings-gear-btn" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>

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
        />
      ) : (
        <div className="finished-screen">
            <h2>Game Over!</h2>
            {players.map(p => (
                <p key={p.id}>{p.username}: {p.linesCompleted} lines {p.hasWon ? '👑' : ''}</p>
            ))}
            <button className="primary-btn" onClick={leaveRoom} style={{marginTop: '2rem'}}>Leave Game</button>
        </div>
      )}

      {(!room || gameState === 'waiting') && (
         <p className="status">Server Connection: {isConnected ? '🟢 Connected' : '🔴 Offline'}</p>
      )}

      {winnerAnnouncement && (
          <div className="massive-winner-overlay">
              <div className="winner-content">
                  <h1 className="winner-rank">{winnerAnnouncement.rank}</h1>
                  <h2 className="winner-name">{winnerAnnouncement.username} wins!</h2>
              </div>
          </div>
      )}

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

    </div>
  )
}

export default App
