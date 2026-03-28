import { useEffect, useState } from 'react';
import './Lobby.css';

export default function Lobby({ socket, roomCode, profile, onLeave }) {
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    socket.emit('get_room_data', roomCode, (response) => {
        if(response.success) {
            setPlayers(response.players);
            const myPlayer = response.players.find(p => p.username === profile.username);
            if (myPlayer && myPlayer.isHost) {
                setIsHost(true);
            }
        }
    });

    const handleLobbyUpdate = (updatedPlayers) => {
      setPlayers(updatedPlayers);
    };

    socket.on('lobby_update', handleLobbyUpdate);

    return () => {
      socket.off('lobby_update', handleLobbyUpdate);
    };
  }, [socket, roomCode, profile]);

  const handleStartGame = () => {
    socket.emit('start_game_request', roomCode);
  };

  return (
    <div className="lobby-container">
      <button className="back-btn" onClick={onLeave}>← Back</button>
      <div className="room-header">
        <h2>Room Code</h2>
        <div className="room-code-badge">{roomCode}</div>
      </div>

      <div className="players-list">
        <h3>Players Waiting ({players.length}/20)</h3>
        <div className="players-grid">
          {players.map((p, index) => {
            const isImg = p.avatar && (p.avatar.startsWith('data:') || p.avatar.startsWith('http'));
            return (
            <div key={index} className="player-card">
              {isImg ? (
                <img 
                  src={p.avatar} 
                  alt="Avatar" 
                  className="player-avatar"
                />
              ) : (
                <div className="player-avatar text-avatar">
                  {p.avatar || p.username?.charAt(0)}
                </div>
              )}
              <div className="player-info">
                <span className="player-name">{p.username} {p.id === socket.id ? '(You)' : ''}</span>
                {p.isHost && <span className="host-badge">HOST</span>}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {isHost ? (
        <button 
          className="primary-btn start-btn" 
          onClick={handleStartGame}
          disabled={players.length < 2}
        >
          {players.length < 2 ? 'Waiting for friends...' : 'Start Game'}
        </button>
      ) : (
        <p className="waiting-text">Waiting for Host to start the game...</p>
      )}
    </div>
  );
}
