import { useState } from 'react';
import './MainMenu.css';

function loadStats() {
  try {
    const raw = localStorage.getItem('crazy_crack_stats');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { gamesPlayed: 0, wins: 0, totalLines: 0 };
}

export default function MainMenu({ profile, onCreateRoom, onJoinRoom, onPlayBot, onBack }) {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const stats = loadStats();

  const handleJoinSubmit = () => {
    if (roomCode.trim().length > 0) {
      onJoinRoom(roomCode.trim().toUpperCase());
    }
  };

  const isImageAvatar = profile.avatar && (profile.avatar.startsWith('data:') || profile.avatar.startsWith('http'));

  return (
    <div className="main-menu">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="profile-display">
        {isImageAvatar ? (
          <img src={profile.avatar} alt="Avatar" className="small-avatar" />
        ) : (
          <div className="small-avatar text-avatar">{profile.avatar || profile.username?.charAt(0)}</div>
        )}
        <h3>{profile.username}</h3>
      </div>

      {/* Stats Bar */}
      {stats.gamesPlayed > 0 && (
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-value">{stats.gamesPlayed}</span>
            <span className="stat-label">Games</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-value">{stats.wins}</span>
            <span className="stat-label">Wins</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalLines}</span>
            <span className="stat-label">Lines</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-value">{stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0}%</span>
            <span className="stat-label">Win Rate</span>
          </div>
        </div>
      )}

      <div className="menu-actions">
        <button className="primary-btn create-btn" onClick={onCreateRoom}>
          Create Room
        </button>

        {!showJoinInput ? (
          <button className="secondary-btn" onClick={() => setShowJoinInput(true)}>
            Join Room
          </button>
        ) : (
          <div className="join-container">
            <input 
              type="text" 
              placeholder="Room Code" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="room-input"
            />
            <button className="primary-btn join-btn" onClick={handleJoinSubmit} disabled={!roomCode}>
              Join
            </button>
            <button className="cancel-btn" onClick={() => setShowJoinInput(false)}>
              ✕
            </button>
          </div>
        )}
        
        <div className="divider"><span>OR</span></div>
        
        <button className="secondary-btn bot-btn" onClick={onPlayBot}>
          🤖 Play vs Computer
        </button>
      </div>
    </div>
  );
}
