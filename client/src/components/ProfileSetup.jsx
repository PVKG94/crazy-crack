import { useState, useRef, useEffect } from 'react';
import './ProfileSetup.css';

export default function ProfileSetup({ onComplete }) {
  const [username, setUsername] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    const savedName = localStorage.getItem('crazy_crack_username');
    const savedAvatar = localStorage.getItem('crazy_crack_avatar');
    
    if (savedName) setUsername(savedName);
    if (savedAvatar) setAvatarPreview(savedAvatar);
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!username.trim()) return;
    
    localStorage.setItem('crazy_crack_username', username);
    
    const finalAvatar = avatarPreview || username.charAt(0).toUpperCase();
    if (avatarPreview) localStorage.setItem('crazy_crack_avatar', finalAvatar);

    const savedAnim = localStorage.getItem('crazy_crack_anim') || 'pop';
    onComplete({ username, avatar: finalAvatar, animStyle: savedAnim });
  };

  return (
    <div className="profile-setup">
      <h2>Create Your Profile</h2>
      
      <div className="avatar-container" onClick={() => fileInputRef.current.click()}>
        {avatarPreview ? (
          <img src={avatarPreview} alt="Avatar Preview" className="avatar-preview" />
        ) : (
          <div className="avatar-placeholder">
            {username ? username.charAt(0).toUpperCase() : '+'}
          </div>
        )}
        <div className="avatar-overlay">Tap to edit</div>
      </div>
      
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />

      <input 
        type="text" 
        placeholder="Enter your Username..." 
        value={username} 
        onChange={(e) => setUsername(e.target.value)} 
        className="username-input"
        maxLength={15}
      />



      <button className="primary-btn" onClick={handleSave} disabled={!username.trim()}>
        Continue
      </button>
    </div>
  );
}
